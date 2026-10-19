import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyDeload, assessPain, deloadDue, nextTarget, returnAfterBreak, shortenSession, substitutes } from '../adjust';
import { getExercise } from '../exercises';
import { buildWeek } from '../planner';
import type { Block } from '../types';

const block: Block = { exerciseId: 'goblet_squat', sets: 3, repMin: 8, repMax: 12, restSec: 75, targetRir: 2, unit: 'reps' };

test('TR-03: all sets at the top of the range with reps to spare adds one step', () => {
  const r = nextTarget({ exerciseId: 'goblet_squat', block, currentLoadKg: 16, history: [[{ reps: 12, loadKg: 16, rir: 2 }, { reps: 12, loadKg: 16, rir: 3 }, { reps: 12, loadKg: 16, rir: 2 }]] });
  assert.equal(r.action, 'increase_load');
  assert.equal(r.loadKg, 17);
});

test('TR-03: missing a set at the top holds the load', () => {
  const r = nextTarget({ exerciseId: 'goblet_squat', block, currentLoadKg: 16, history: [[{ reps: 12, loadKg: 16 }, { reps: 11, loadKg: 16 }, { reps: 10, loadKg: 16 }]] });
  assert.equal(r.action, 'hold');
  assert.equal(r.loadKg, 16);
});

test('TR-03: "too hard" never increases the load', () => {
  const r = nextTarget({ exerciseId: 'goblet_squat', block, currentLoadKg: 16, feel: 'too_hard', history: [[{ reps: 12, loadKg: 16, rir: 2 }, { reps: 12, loadKg: 16, rir: 2 }, { reps: 12, loadKg: 16, rir: 2 }]] });
  assert.notEqual(r.action, 'increase_load');
  assert.equal(r.loadKg, 16);
});

test('TR-03: below the range two sessions running drops about 10 per cent', () => {
  const low = [{ reps: 6, loadKg: 20 }, { reps: 7, loadKg: 20 }, { reps: 5, loadKg: 20 }];
  const r = nextTarget({ exerciseId: 'goblet_squat', block, currentLoadKg: 20, history: [low, low] });
  assert.equal(r.action, 'decrease_load');
  assert.equal(r.loadKg, 18);
});

test('TR-03: barbell lifts step by 2.5 kg', () => {
  const b: Block = { ...block, exerciseId: 'back_squat', repMin: 5, repMax: 8 };
  const top = [{ reps: 8, loadKg: 60, rir: 2 }, { reps: 8, loadKg: 60, rir: 2 }, { reps: 8, loadKg: 60, rir: 2 }];
  assert.equal(nextTarget({ exerciseId: 'back_squat', block: b, currentLoadKg: 60, history: [top] }).loadKg, 62.5);
});

test('TR-03: bodyweight moves suggest a harder version instead of load', () => {
  const b: Block = { ...block, exerciseId: 'knee_pushup' };
  const top = [{ reps: 12, loadKg: 0, rir: 3 }, { reps: 12, loadKg: 0, rir: 3 }, { reps: 12, loadKg: 0, rir: 3 }];
  assert.equal(nextTarget({ exerciseId: 'knee_pushup', block: b, currentLoadKg: 0, history: [top] }).action, 'suggest_harder');
});

test('TR-04: deload is scheduled after 5 weeks or triggered by drops plus low energy', () => {
  assert.equal(deloadDue({ weeksSinceDeload: 5, performanceDrops: 0 }), 'scheduled');
  assert.equal(deloadDue({ weeksSinceDeload: 2, performanceDrops: 2, energy: 2 }), 'triggered');
  assert.equal(deloadDue({ weeksSinceDeload: 2, performanceDrops: 2, energy: 4 }), null);
});

const session = buildWeek(
  { goal: 'muscle_gain', experience: '6to24m', location: 'gym', equipment: ['dumbbells', 'bench', 'cable', 'machines'], daysAvailable: [0, 2, 4], sessionMinutes: 60 },
  [],
  '2026-10-19',
).sessions[0]!;

test('TR-04: deload halves sets and keeps at least one', () => {
  const d = applyDeload(session);
  d.blocks.forEach((b, i) => assert.equal(b.sets, Math.max(1, Math.ceil(session.blocks[i]!.sets / 2))));
});

test('TR-08: return after a break scales volume and load', () => {
  assert.deepEqual(returnAfterBreak(3), { volumeFactor: 1, loadFactor: 1 });
  assert.deepEqual(returnAfterBreak(10), { volumeFactor: 0.7, loadFactor: 1 });
  assert.deepEqual(returnAfterBreak(30), { volumeFactor: 0.7, loadFactor: 0.55 });
});

test('TR-06: shortening keeps the main lift and never lowers reps in reserve', () => {
  const r = shortenSession(session, 15);
  assert.equal(r.kind, 'session');
  if (r.kind !== 'session') return;
  assert.equal(r.session.blocks[0]!.exerciseId, session.blocks[0]!.exerciseId);
  for (const b of r.session.blocks) {
    const original = session.blocks.find((x) => x.exerciseId === b.exerciseId)!;
    assert.ok(b.targetRir >= original.targetRir);
    assert.equal(b.repMax, original.repMax);
  }
  assert.ok(r.session.estimatedMinutes <= 15, `fits (${r.session.estimatedMinutes})`);
});

test('TR-06: under 10 minutes offers mobility or a walk', () => {
  assert.equal(shortenSession(session, 8).kind, 'alternative');
});

test('TR-07: substitutes respect restrictions and never return the original', () => {
  const subs = substitutes('goblet_squat', { equipment: ['dumbbells', 'bench', 'machines'], restrictions: [{ code: 'region:knee', source: 'pain_report' }], experience: 'gt2y' });
  for (const s of subs) {
    assert.notEqual(s.id, 'goblet_squat');
    assert.equal(s.pattern, 'squat');
    assert.ok(!s.tags.includes('deep_knee_flexion_loaded') && !s.tags.includes('knee_load'));
  }
});

test('TR-07: substitutes are real catalogue entries, at most 3', () => {
  const subs = substitutes('db_row', { equipment: ['dumbbells', 'bands', 'cable'], restrictions: [], experience: '6to24m' });
  assert.ok(subs.length >= 1 && subs.length <= 3);
  for (const s of subs) assert.ok(getExercise(s.id));
});

test('TR-07: unknown exercise returns nothing rather than inventing', () => {
  assert.deepEqual(substitutes('made_up', { equipment: [], restrictions: [], experience: 'none' }), []);
});

test('pain: red flag is an emergency, 7+ ends the session, 4 to 6 stops the exercise', () => {
  assert.equal(assessPain({ region: 'knee', rating: 2, redFlag: true }, '2026-10-19').action, 'emergency');
  const end = assessPain({ region: 'knee', rating: 8 }, '2026-10-19');
  assert.equal(end.action, 'end_session');
  if (end.action === 'end_session') assert.equal(end.restriction.expiresAt, '2026-10-26');
  assert.equal(assessPain({ region: 'knee', rating: 3, swelling: true }, '2026-10-19').action, 'end_session');
  assert.equal(assessPain({ region: 'shoulder', rating: 5 }, '2026-10-19').action, 'stop_exercise');
  assert.equal(assessPain({ region: 'shoulder', rating: 2 }, '2026-10-19').action, 'continue_lighter');
});
