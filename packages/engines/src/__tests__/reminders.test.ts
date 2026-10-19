import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_REMINDERS, MAX_PER_WEEK, inQuietHours, outsideQuietHours, planReminders } from '../reminders';

const week = { weekStart: '2026-10-19', today: '2026-10-19', sessions: [{ day: 0, title: 'Full body A', done: false }, { day: 2, title: 'Full body B', done: false }, { day: 4, title: 'Full body A', done: false }] };
const on = { ...DEFAULT_REMINDERS, enabled: true };

test('off by default: nothing is scheduled until the user opts in', () => {
  assert.deepEqual(planReminders(DEFAULT_REMINDERS, week), []);
});

test('quiet hours across midnight', () => {
  assert.equal(inQuietHours('23:30', '22:00', '07:00'), true);
  assert.equal(inQuietHours('06:59', '22:00', '07:00'), true);
  assert.equal(inQuietHours('07:00', '22:00', '07:00'), false);
  assert.equal(outsideQuietHours('22:30', '22:00', '07:00'), '07:00');
  assert.equal(inQuietHours('13:00', '12:00', '14:00'), true);
});

test('no reminder for a session that is already done or in the past', () => {
  const r = planReminders(on, { ...week, today: '2026-10-21', sessions: [{ day: 0, title: 'A', done: false }, { day: 2, title: 'B', done: true }, { day: 4, title: 'C', done: false }] });
  assert.deepEqual(r.filter((x) => x.category === 'session').map((x) => x.day), ['2026-10-23']);
});

test('never inside quiet hours', () => {
  const r = planReminders({ ...on, sessionTime: '23:15', categories: { session: true, check_in: true, weekly_review: true }, checkInTime: '05:00' }, week);
  for (const x of r) assert.equal(inQuietHours(x.time, on.quietStart, on.quietEnd), false, `${x.id} at ${x.time}`);
});

test('at most 5 a week, sessions first', () => {
  const r = planReminders({ ...on, categories: { session: true, check_in: true, weekly_review: true } }, week);
  assert.ok(r.length <= MAX_PER_WEEK);
  assert.equal(r.filter((x) => x.category === 'session').length, 3);
});

test('pause stops reminders until the date', () => {
  const r = planReminders({ ...on, pausedUntil: '2026-10-22' }, week);
  assert.ok(r.every((x) => x.day >= '2026-10-22'));
});
