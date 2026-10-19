import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildWeek } from '../planner';
import { weeklyReview, type ReviewInput } from '../review';

const base: ReviewInput = {
  plannedSessions: 3, completedSessions: 3, partialSessions: 0, feels: ['right', 'right', 'right'], energies: [3, 4, 3],
  setsLogged: 27, weeksSinceDeload: 1, sessionMinutes: 45, volumeBonus: 0, declined: {}, today: '2026-10-25',
};

test('no data means no changes and says so', () => {
  const r = weeklyReview({ ...base, completedSessions: 0, partialSessions: 0, feels: [], energies: [], setsLogged: 0 });
  assert.equal(r.insufficient, true);
  assert.equal(r.changes.length, 0);
});

test('a normal week proposes nothing', () => {
  const r = weeklyReview(base);
  assert.equal(r.changes.length, 0);
  assert.equal(r.insufficient, false);
});

test('two too-hard sessions propose a lighter week (TR-04)', () => {
  const r = weeklyReview({ ...base, feels: ['too_hard', 'too_hard', 'right'] });
  assert.equal(r.changes[0]?.kind, 'deload_next_week');
  assert.deepEqual(r.changes[0]?.ruleIds, ['TR-04']);
});

test('five weeks without a lighter week schedules one', () => {
  assert.equal(weeklyReview({ ...base, weeksSinceDeload: 5 }).changes[0]?.kind, 'deload_next_week');
});

test('finishing under half the sessions proposes shorter sessions, never below 15 min', () => {
  const r = weeklyReview({ ...base, completedSessions: 1, sessionMinutes: 20 });
  const c = r.changes.find((x) => x.kind === 'shorten_sessions');
  assert.ok(c);
  assert.match(c.title, /15 min/);
});

test('all sessions too easy proposes more volume, never alongside a deload', () => {
  assert.equal(weeklyReview({ ...base, feels: ['too_easy', 'too_easy', 'too_easy'] }).changes[0]?.kind, 'add_volume');
  const both = weeklyReview({ ...base, feels: ['too_easy', 'too_easy', 'too_easy'], weeksSinceDeload: 6 });
  assert.ok(!both.changes.some((c) => c.kind === 'add_volume'));
});

test('at most two changes', () => {
  const r = weeklyReview({ ...base, completedSessions: 1, feels: ['too_hard', 'too_hard'], energies: [1, 2, 1] });
  assert.ok(r.changes.length <= 2);
});

test('a change declined in the last 14 days is not proposed again', () => {
  assert.equal(weeklyReview({ ...base, feels: ['too_hard', 'too_hard', 'right'], declined: { deload_next_week: '2026-10-20' } }).changes.length, 0);
  assert.equal(weeklyReview({ ...base, feels: ['too_hard', 'too_hard', 'right'], declined: { deload_next_week: '2026-10-01' } }).changes.length, 1);
});

test('measured facts and estimates are kept separate', () => {
  const r = weeklyReview(base);
  assert.ok(r.facts.some((f) => f.label === 'Sessions done'));
  assert.ok(r.estimates.every((e) => /self-rated/.test(e.label)));
});

test('accepted deload halves sets; accepted volume adds at most 2 sets to the first two exercises', () => {
  const p = { goal: 'muscle_gain' as const, experience: '6to24m' as const, location: 'gym' as const, equipment: ['dumbbells', 'bench', 'cable'] as const, daysAvailable: [0, 2, 4], sessionMinutes: 90 };
  const normal = buildWeek({ ...p, equipment: [...p.equipment] }, [], '2026-10-19');
  const light = buildWeek({ ...p, equipment: [...p.equipment] }, [], '2026-10-19', { deload: true });
  const more = buildWeek({ ...p, equipment: [...p.equipment] }, [], '2026-10-19', { volumeBonus: 5 });
  const s0 = normal.sessions[0]!;
  light.sessions[0]!.blocks.forEach((b, i) => assert.equal(b.sets, Math.max(1, Math.ceil(s0.blocks[i]!.sets / 2))));
  assert.equal(more.sessions[0]!.blocks[0]!.sets, s0.blocks[0]!.sets + 2);
  assert.equal(more.sessions[0]!.blocks[2]!.sets, s0.blocks[2]!.sets);
});
