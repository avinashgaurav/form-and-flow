/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState, type AppState } from '../../store/types';
import { applyBackup, buildPush, idKey, mergeBackup, mergeFood, mergeSettings, mergeWeights, missingIdKeys, setRow, type ServerSession, type ServerSet } from '../syncMap';

const U = '00000000-0000-4000-8000-000000000001';

function base(): AppState {
  const s = initialState();
  return {
    ...s,
    hydrated: true,
    onboarded: true,
    profile: {
      birthYear: 1990, units: 'metric', tone: 'gentle', timezone: 'Asia/Kolkata', goal: 'strength',
      training: { goal: 'strength', experience: '6to24m', location: 'home', equipment: ['dumbbells'], daysAvailable: [0, 2, 4], sessionMinutes: 45 },
    },
    consents: { core: true, aiProcessing: true, version: 'v1', at: '2026-10-19T10:00:00.000Z' },
    sessions: {
      a: { key: 'a', status: 'completed', startedAt: '2026-10-19T12:00:00.000Z', swaps: {} },
      b: { key: 'b', status: 'planned', startedAt: '2026-10-20T12:00:00.000Z', swaps: {} },
    },
    sets: [
      { id: 's1', sessionKey: 'a', exerciseId: 'goblet_squat', setIndex: 1, reps: 10, loadKg: 16, rir: 2, at: '2026-10-19T12:10:00.000Z' },
      { id: 's2', sessionKey: 'a', exerciseId: 'plank', setIndex: 1, reps: 45, loadKg: 0, at: '2026-10-19T12:20:00.000Z' },
    ],
    checkIns: { '2026-10-19': { day: '2026-10-19', energy: 4, minutes: 30 } },
  };
}

test('started workouts, check-ins and consent changes need operation IDs; planned workouts do not', () => {
  const at = base().consents!.at;
  assert.deepEqual(missingIdKeys(base()).sort(), [idKey.checkIn('2026-10-19'), idKey.session('a'), idKey.consent('core', at), idKey.consent('ai_processing', at)].sort());
});

test('push rows carry the user ID and skip rows without an operation ID', () => {
  const s = base();
  const none = buildPush(s, U);
  assert.equal(none.sessions.length, 0);
  s.sync.ids = { [idKey.session('a')]: 'op-a', [idKey.checkIn('2026-10-19')]: 'op-c' };
  const r = buildPush(s, U);
  assert.equal(r.sessions.length, 1);
  assert.equal(r.setsBySession['op-a']!.length, 2);
  assert.ok([r.profile, ...r.consents, ...r.sessions, ...r.checkIns].every((x) => (x as { user_id: string }).user_id === U));
});

const withIds = (s: AppState) => {
  for (const k of missingIdKeys(s)) s.sync.ids[k] = `00000000-0000-4000-8000-${String(Object.keys(s.sync.ids).length).padStart(12, '0')}`;
  return s;
};

test('consent rows are sent once with operation IDs, then only when consent changes', () => {
  const s = withIds(base());
  const first = buildPush(s, U);
  assert.equal(first.consents.length, 2);
  const ops = first.consents.map((c) => (c as { client_op_id: string }).client_op_id);
  assert.equal(new Set(ops).size, 2);
  assert.ok(first.consents.every((c) => !('at' in c)), 'the database stamps the consent time');
  s.sync.consentAt = first.cursor.consentAt;
  assert.equal(buildPush(s, U).consents.length, 0);
  s.consents = { ...s.consents!, aiProcessing: false, at: '2026-10-20T09:00:00.000Z' };
  assert.equal(buildPush(s, U).consents.length, 0, 'not sent until the new change has IDs');
  withIds(s);
  const changed = buildPush(s, U).consents as { purpose: string; granted: boolean }[];
  assert.equal(changed.find((c) => c.purpose === 'ai_processing')!.granted, false);
});

test('only sets and meals changed since the last good push are sent again', () => {
  const s = withIds(base());
  assert.equal(buildPush(s, U).setsBySession[s.sync.ids[idKey.session('a')]!]!.length, 2);
  s.sync.pushedFrom = '2026-10-19T14:00:00.000Z';
  assert.equal(Object.keys(buildPush(s, U).setsBySession).length, 0);
  s.sync.pushedFrom = '2026-10-19T13:15:00.000Z';
  assert.equal(buildPush(s, U).setsBySession[s.sync.ids[idKey.session('a')]!]!.length, 1, 'one-hour overlap keeps the later set');
});

test('only the newest of two in-progress workouts is sent as in progress', () => {
  const s = base();
  s.sessions.a = { ...s.sessions.a!, status: 'in_progress', startedAt: '2026-10-18T12:00:00.000Z' };
  s.sessions.c = { key: 'c', status: 'in_progress', startedAt: '2026-10-19T12:00:00.000Z', swaps: {} };
  withIds(s);
  const rows = buildPush(s, U).sessions as { plan_session_key: string; status: string }[];
  assert.equal(rows.find((r) => r.plan_session_key === 'a')!.status, 'partial');
  assert.equal(rows.find((r) => r.plan_session_key === 'c')!.status, 'in_progress');
});

test('timed holds are sent as seconds and bodyweight moves without a load', () => {
  const hold = setRow(U, base().sets[1]!);
  assert.equal(hold.reps, null);
  assert.equal(hold.duration_s, 45);
  assert.equal(hold.load_kg, null);
  const squat = setRow(U, base().sets[0]!);
  assert.equal(squat.reps, 10);
  assert.equal(squat.load_kg, 16);
});

const serverSession = (op: string, key: string | null): ServerSession => ({ id: `srv-${op}`, client_op_id: op, plan_session_key: key, status: 'completed', started_at: '2026-10-18T12:00:00.000Z', ended_at: null, feel: 'right' });
const serverSet = (op: string, sessionOp: string): ServerSet => ({ client_op_id: op, session_id: `srv-${sessionOp}`, exercise_id: 'goblet_squat', set_index: 1, reps: 8, duration_s: null, load_kg: 14, effort_rir: 2, logged_at: '2026-10-18T12:05:00.000Z' });

test('restore adds workouts that only exist in the backup', () => {
  const m = mergeBackup(base(), { sessions: [serverSession('op-x', 'x')], sets: [serverSet('sx', 'op-x')], checkIns: [] });
  assert.equal(m.sessions.x!.status, 'completed');
  assert.equal(m.newSets.length, 1);
  assert.equal(m.ids[idKey.session('x')], 'op-x');
  assert.equal(m.conflicts.length, 0);
});

test('restore fills missing sets of the same workout without duplicating', () => {
  const s = base();
  s.sync.ids = { [idKey.session('a')]: 'op-a' };
  const m = mergeBackup(s, { sessions: [serverSession('op-a', 'a')], sets: [serverSet('s1', 'op-a'), serverSet('s9', 'op-a')], checkIns: [] });
  assert.deepEqual(m.newSets.map((x) => x.id), ['s9']);
});

test('a different workout on the same plan day becomes a conflict, not an overwrite', () => {
  const s = base();
  s.sync.ids = { [idKey.session('a')]: 'op-a' };
  const m = mergeBackup(s, { sessions: [serverSession('op-other', 'a')], sets: [serverSet('z', 'op-other')], checkIns: [] });
  assert.equal(m.conflicts.length, 1);
  assert.equal(m.sessions.a, s.sessions.a);
  assert.equal(m.conflicts[0]!.phone.sets, 2);
  assert.equal(m.conflicts[0]!.backup.sets.length, 1);
  // Restoring twice does not list the same conflict twice.
  const again = mergeBackup({ ...s, sync: { ...s.sync, conflicts: m.conflicts } }, { sessions: [serverSession('op-other', 'a')], sets: [], checkIns: [] });
  assert.equal(again.conflicts.length, 1);
});

test('the phone wins for a check-in on the same day', () => {
  const m = mergeBackup(base(), { sessions: [], sets: [], checkIns: [{ day: '2026-10-19', energy: 1, minutes_available: 5, pain: true, client_op_id: 'c' }, { day: '2026-10-18', energy: 3, minutes_available: 20, pain: false, client_op_id: 'd' }] });
  assert.equal(m.checkIns['2026-10-19']!.energy, 4);
  assert.equal(m.checkIns['2026-10-18']!.energy, 3);
  assert.equal(m.added.checkIns, 1);
});

/* ---------- Food ---------- */

import { snapshot } from '@ff/engines';
import { mealRows } from '../syncMap';

const dal = { food: { kind: 'dish' as const, id: 'dal_tadka' }, quantity: 1, unit: 'katori' as const };

test('meal rows store the frozen snapshot and a sized portion', () => {
  const snap = snapshot(dal);
  const r = mealRows(U, 'Asia/Kolkata', { id: 'm1', day: '2026-10-19', at: '2026-10-19T08:00:00.000Z', mealType: 'lunch', source: 'search', items: [{ id: 'i1', name: 'Dal tadka', ...dal, snapshot: snap }] });
  assert.equal(r.meal.client_op_id, 'm1');
  assert.equal(r.items[0]!.food_id, 'dish:dal_tadka');
  assert.ok(r.items[0]!.grams > 0);
  assert.deepEqual(r.items[0]!.nutrients_snapshot, snap);
});

test('only logs can be deleted from the phone, children first, never safety or consent records', () => {
  const s = base();
  const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
  s.sync.deleted = [`meal_logs:${id(1)}`, `saved_meals:${id(2)}`, `profiles:${id(3)}`, `safety_events:${id(4)}`, 'meal_log_items:', `exercise_sets:${id(5)}`, `workout_sessions:${id(6)}`, 'meal_logs:not-an-id;drop'];
  assert.deepEqual(buildPush(s, U).deletes.map((d) => d.raw), [`exercise_sets:${id(5)}`, `workout_sessions:${id(6)}`, `meal_logs:${id(1)}`, `saved_meals:${id(2)}`]);
});

test('restore never brings back what the phone deleted', () => {
  const s = base();
  s.sync.deleted = ['workout_sessions:op-gone', 'exercise_sets:s-gone', 'meal_logs:m-gone'];
  const m = mergeBackup(s, { sessions: [serverSession('op-gone', 'g'), serverSession('op-x', 'x')], sets: [serverSet('s-gone', 'op-x'), serverSet('s-ok', 'op-x')], checkIns: [] });
  assert.equal(m.sessions.g, undefined);
  assert.deepEqual(m.newSets.map((x) => x.id), ['s-ok']);
  const f = mergeFood(s, { meals: [{ id: 'srv', client_op_id: 'm-gone', eaten_at: '2026-10-18T08:00:00.000Z', day: '2026-10-18', meal_type: 'lunch', source: 'search' }], items: [], saved: [] });
  assert.equal(f.added.meals, 0);
});

test('linking a new phone merges safety settings in the safe direction', () => {
  const s = base();
  s.restrictions = [{ code: 'region:shoulder', source: 'pain_report', expiresAt: '2026-10-26' }];
  s.nutrition = { ...s.nutrition, allergens: ['peanut'] };
  const r = mergeSettings(s, {
    profile: { nutrition_mode: 'non_numeric' },
    preferences: { diet_pattern: 'jain', allergens: ['milk'], allergen_free_text: ['kaju'] },
    restrictions: [{ code: 'region:shoulder', source: 'assessment', expires_at: null }, { code: 'region:knee', source: 'assessment', expires_at: null }],
  });
  assert.deepEqual(r.nutrition.allergens.sort(), ['milk', 'peanut']);
  assert.deepEqual(r.nutrition.freeTextAllergies, ['kaju']);
  assert.equal(r.nutrition.mode, 'non_numeric', 'plate guidance wins');
  assert.equal(r.nutrition.jain, true);
  assert.equal(r.restrictions.find((x) => x.code === 'region:shoulder')!.expiresAt, undefined, 'permanent beats temporary');
  assert.ok(r.restrictions.some((x) => x.code === 'region:knee'));
});

test('applying a backup links the phone and never duplicates sets', () => {
  const s = withIds(base());
  const opA = s.sync.ids[idKey.session('a')]!;
  const data = { sessions: [serverSession(opA, 'a')], sets: [serverSet('s1', opA), serverSet('s7', opA)], checkIns: [], meals: [], items: [], saved: [], profile: null, preferences: null, restrictions: [], weights: [] };
  const once = applyBackup(s, data, U);
  const twice = applyBackup(once, data, U);
  assert.equal(once.sync.linkedUserId, U);
  assert.deepEqual(twice.sets.map((x) => x.id).sort(), ['s1', 's2', 's7']);
});

test('Jain and eggetarian map to the backup diet names', () => {
  const s = base();
  s.nutrition = { ...s.nutrition, diet: 'egg' };
  assert.equal(buildPush(s, U).preferences!.diet_pattern, 'eggetarian');
  s.nutrition = { ...s.nutrition, diet: 'veg', jain: true };
  assert.equal(buildPush(s, U).preferences!.diet_pattern, 'jain');
});

test('restore adds meals only in the backup and keeps their logged numbers', () => {
  const snap = snapshot(dal);
  const s = base();
  s.meals = [{ id: 'mine', day: '2026-10-19', at: '2026-10-19T08:00:00.000Z', mealType: 'breakfast', source: 'search', items: [] }];
  const r = mergeFood(s, {
    meals: [
      { id: 'srv1', client_op_id: 'mine', eaten_at: '2026-10-19T08:00:00.000Z', day: '2026-10-19', meal_type: 'breakfast', source: 'search' },
      { id: 'srv2', client_op_id: 'other', eaten_at: '2026-10-18T13:00:00.000Z', day: '2026-10-18', meal_type: 'lunch', source: 'text_parse' },
    ],
    items: [{ meal_log_id: 'srv2', client_op_id: 'it', name: 'Dal tadka', qty: 1, unit: 'katori', oil_level: null, nutrients_snapshot: snap }],
    saved: [],
  });
  assert.equal(r.added.meals, 1);
  const restored = r.meals.find((m) => m.id === 'other')!;
  assert.deepEqual(restored.items[0]!.snapshot, snap);
  assert.equal(restored.items[0]!.unit, 'katori');
});

test('the in-progress workout is sent after the one it replaced', () => {
  const s = base();
  s.sessions = {
    z: { key: 'z', status: 'in_progress', startedAt: '2026-10-19T12:00:00.000Z', swaps: {} },
    a: { key: 'a', status: 'partial', startedAt: '2026-10-18T12:00:00.000Z', swaps: {} },
    m: { key: 'm', status: 'completed', startedAt: '2026-10-17T12:00:00.000Z', swaps: {} },
  };
  withIds(s);
  const rows = buildPush(s, U).sessions as { status: string }[];
  assert.equal(rows[rows.length - 1]!.status, 'in_progress');
  assert.equal(rows.filter((r) => r.status === 'in_progress').length, 1);
});

test('weigh-ins back up with their own IDs, edits update them, and deleted ones never come back', () => {
  const s = base();
  s.weights = [{ id: 'w1', kg: 80.2, at: '2026-10-18T02:00:00.000Z', day: '2026-10-18' }, { id: 'w2', kg: 79.9, at: '2026-10-19T02:00:00.000Z', day: '2026-10-19' }];
  s.sync.deleted = ['progress_entries:w2'];
  const rows = buildPush(s, U).weights as { client_op_id: string; metric: string; value: number }[];
  assert.deepEqual(rows.map((r) => [r.client_op_id, r.metric, r.value]), [['w1', 'weight_kg', 80.2]]);
  const merged = mergeWeights(s, [
    { client_op_id: 'w1', value: 80.2, measured_at: '2026-10-18T02:00:00.000Z' },
    { client_op_id: 'w2', value: 79.9, measured_at: '2026-10-19T02:00:00.000Z' },
    { client_op_id: 'w3', value: 79.5, measured_at: '2026-10-19T19:00:00.000Z' },
  ]);
  assert.deepEqual(merged.map((w) => w.id).sort(), ['w1', 'w2', 'w3'], 'w2 is still on the phone; w3 is new');
  const afterDelete = mergeWeights({ ...s, weights: s.weights.filter((w) => w.id !== 'w2') }, [{ client_op_id: 'w2', value: 79.9, measured_at: '2026-10-19T02:00:00.000Z' }]);
  assert.ok(!afterDelete.some((w) => w.id === 'w2'));
  assert.equal(merged.find((w) => w.id === 'w3')!.day, '2026-10-19', 'a 00:30 India-time weigh-in belongs to the evening before (04:00 day rule)');
});
