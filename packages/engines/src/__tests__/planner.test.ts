import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXERCISES, getExercise } from '../exercises';
import { buildWeek, pickTrainingDays } from '../planner';
import { excludedTags, hasEquipment, maxLevelFor } from '../restrictions';
import type { Equipment, Experience, Goal, Region, Restriction, TrainingProfile } from '../types';

/** Small seeded PRNG so the property test is reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const pick = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
const subset = <T>(r: () => number, xs: readonly T[]): T[] => xs.filter(() => r() < 0.5);

const GOALS: Goal[] = ['fat_loss', 'muscle_gain', 'strength', 'fitness', 'mobility', 'habits', 'maintenance'];
const EXP: Experience[] = ['none', 'lt6m', '6to24m', 'gt2y'];
const EQUIP: Equipment[] = ['dumbbells', 'kettlebell', 'bands', 'bench', 'barbell', 'rack', 'cable', 'machines', 'pullup_bar'];
const REGIONS: Region[] = ['knee', 'lower_back', 'shoulder', 'wrist'];

function randomProfile(r: () => number): { profile: TrainingProfile; restrictions: Restriction[] } {
  const days = subset(r, [0, 1, 2, 3, 4, 5, 6]);
  const restrictions: Restriction[] = subset(r, REGIONS).map((x) => ({ code: `region:${x}` as const, source: 'assessment' as const }));
  if (r() < 0.2) restrictions.push({ code: 'intensity_cap_moderate', source: 'assessment' });
  return {
    profile: {
      goal: pick(r, GOALS),
      experience: pick(r, EXP),
      location: pick(r, ['home', 'gym', 'both'] as const),
      equipment: subset(r, EQUIP),
      daysAvailable: days.length ? days : [2],
      sessionMinutes: 10 + Math.floor(r() * 111),
    },
    restrictions,
  };
}

test('property: 1,000 random profiles never break equipment, restriction, level or rest-day rules', () => {
  const r = rng(42);
  for (let i = 0; i < 1000; i++) {
    const { profile, restrictions } = randomProfile(r);
    const week = buildWeek(profile, restrictions, '2026-10-19');
    const banned = excludedTags(restrictions);
    const eq = new Set(profile.equipment);
    assert.ok(week.sessions.length <= 6, 'at most 6 sessions');
    assert.ok(week.restDays.length >= 1, 'at least one rest day');
    for (const s of week.sessions) {
      assert.ok(profile.daysAvailable.includes(s.day), 'session on an available day');
      for (const b of s.blocks) {
        const ex = getExercise(b.exerciseId)!;
        assert.ok(ex, `known exercise ${b.exerciseId}`);
        assert.ok(hasEquipment(ex, eq), `equipment for ${ex.id} with ${[...eq]}`);
        assert.ok(!ex.tags.some((t) => banned.has(t)), `restriction respected for ${ex.id}`);
        assert.ok(ex.level <= maxLevelFor(profile.experience), `level ok for ${ex.id}`);
        assert.ok(b.sets >= 1);
      }
      const ids = s.blocks.map((b) => b.exerciseId);
      assert.equal(new Set(ids).size, ids.length, 'no duplicate exercise within a session');
    }
  }
});

test('deterministic: same input gives the same week', () => {
  const r = rng(7);
  const { profile, restrictions } = randomProfile(r);
  assert.deepEqual(buildWeek(profile, restrictions, '2026-10-19'), buildWeek(profile, restrictions, '2026-10-19'));
});

test('a bodyweight-only beginner gets a full plan with no equipment', () => {
  const week = buildWeek(
    { goal: 'fat_loss', experience: 'none', location: 'home', equipment: [], daysAvailable: [0, 2, 4], sessionMinutes: 30 },
    [],
    '2026-10-19',
  );
  assert.equal(week.sessions.length, 3);
  for (const s of week.sessions) {
    assert.ok(s.blocks.length >= 3, `enough exercises in ${s.title}`);
    for (const b of s.blocks) assert.equal(getExercise(b.exerciseId)!.anyOf.length + getExercise(b.exerciseId)!.allOf.length, 0);
    assert.ok(s.estimatedMinutes <= 30, `${s.title} fits in 30 minutes (${s.estimatedMinutes})`);
  }
});

test('a knee restriction removes every knee-loading exercise', () => {
  const week = buildWeek(
    { goal: 'muscle_gain', experience: 'gt2y', location: 'gym', equipment: ['dumbbells', 'barbell', 'rack', 'bench', 'machines', 'cable'], daysAvailable: [0, 1, 3, 4], sessionMinutes: 60 },
    [{ code: 'region:knee', source: 'pain_report' }],
    '2026-10-19',
  );
  const tags = week.sessions.flatMap((s) => s.blocks.flatMap((b) => getExercise(b.exerciseId)!.tags));
  for (const t of ['deep_knee_flexion_loaded', 'knee_load', 'impact']) assert.ok(!tags.includes(t as never), t);
});

test('red flag pauses the whole week', () => {
  const week = buildWeek(
    { goal: 'fitness', experience: 'none', location: 'home', equipment: [], daysAvailable: [0, 2, 4], sessionMinutes: 30 },
    [{ code: 'red_flag', source: 'assessment' }],
    '2026-10-19',
  );
  assert.equal(week.paused, true);
  assert.equal(week.sessions.length, 0);
});

test('limited mode keeps at least 3 reps in reserve and no heavy lifts', () => {
  const week = buildWeek(
    { goal: 'strength', experience: 'gt2y', location: 'gym', equipment: ['barbell', 'rack', 'bench', 'dumbbells'], daysAvailable: [0, 2, 4], sessionMinutes: 60 },
    [{ code: 'intensity_cap_moderate', source: 'assessment' }],
    '2026-10-19',
  );
  for (const s of week.sessions)
    for (const b of s.blocks) {
      assert.ok(b.targetRir >= 3);
      assert.ok(!getExercise(b.exerciseId)!.tags.includes('heavy'));
    }
});

test('seven available days still leave a rest day', () => {
  const week = buildWeek(
    { goal: 'muscle_gain', experience: '6to24m', location: 'gym', equipment: ['dumbbells', 'bench', 'cable'], daysAvailable: [0, 1, 2, 3, 4, 5, 6], sessionMinutes: 45 },
    [],
    '2026-10-19',
  );
  assert.equal(week.sessions.length, 6);
  assert.equal(week.restDays.length, 1);
  assert.ok(week.needsReview.includes('TR-01 five or six day split'));
});

test('beginners are capped at 4 sessions', () => {
  assert.equal(buildWeek({ goal: 'fitness', experience: 'none', location: 'home', equipment: [], daysAvailable: [0, 1, 2, 3, 4, 5], sessionMinutes: 30 }, [], '2026-10-19').sessions.length, 4);
});

test('pickTrainingDays spreads sessions out', () => {
  assert.deepEqual(pickTrainingDays([0, 1, 2, 3, 4, 5, 6], 3), [0, 2, 4]);
  assert.deepEqual(pickTrainingDays([1, 3], 3), [1, 3]);
  assert.deepEqual(pickTrainingDays([], 3), []);
});

test('catalogue sanity: unique IDs, cues present, every pattern has a bodyweight option', () => {
  const ids = EXERCISES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of EXERCISES) assert.ok(e.cues.length >= 1, e.id);
  for (const p of ['squat', 'hinge', 'lunge', 'push_h', 'pull_h', 'core', 'carry'] as const) {
    assert.ok(EXERCISES.some((e) => e.pattern === p && e.anyOf.length === 0 && e.allOf.length === 0), `bodyweight ${p}`);
  }
});
