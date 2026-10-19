import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAP_DAYS, trendSegments, weightPoints, weightTrendSummary, workoutsPerWeek, type WeightEntry } from '../progress';

const e = (day: string, kg: number, hour = 7): WeightEntry => ({ id: `${day}-${hour}`, kg, day, at: `${day}T${String(hour).padStart(2, '0')}:00:00.000Z` });

test('two weigh-ins on one day: both kept in history, the latest counts', () => {
  const pts = weightPoints([e('2026-10-01', 80, 7), e('2026-10-01', 79.4, 21)]);
  assert.equal(pts.length, 1);
  assert.equal(pts[0]!.kg, 79.4);
});

test('a gap of a week or more breaks the trend line and restarts it', () => {
  const pts = weightPoints([e('2026-10-01', 80), e('2026-10-02', 79.8), e('2026-10-02', 79.8), e(`2026-10-${String(2 + GAP_DAYS).padStart(2, '0')}`, 78)]);
  assert.deepEqual(pts.map((p) => p.segment), [0, 0, 1]);
  assert.equal(pts[2]!.trendKg, 78, 'a new stretch starts from its own first weigh-in');
});

test('no trend until a week of data, and only within the latest stretch', () => {
  assert.deepEqual(weightTrendSummary(weightPoints([e('2026-10-01', 80), e('2026-10-04', 79.5)])), { status: 'too_early', daysOfData: 4 });
  const days = Array.from({ length: 15 }, (_, i) => e(`2026-10-${String(i + 1).padStart(2, '0')}`, 80 - i * 0.1));
  const s = weightTrendSummary(weightPoints(days));
  assert.equal(s.status, 'ok');
  if (s.status === 'ok') {
    assert.ok(s.changeKg < 0);
    assert.equal(s.toDay, '2026-10-15');
  }
});

test('workouts are counted per Monday week, including empty weeks', () => {
  const w = workoutsPerWeek(['2026-10-05', '2026-10-07', '2026-10-19'], '2026-10-19', 3);
  assert.deepEqual(w, [
    { weekStart: '2026-10-05', count: 2 },
    { weekStart: '2026-10-12', count: 0 },
    { weekStart: '2026-10-19', count: 1 },
  ]);
});

test('a week of weigh-ins (first to seventh day) is enough for a trend, and only then is a line drawn', () => {
  const week = Array.from({ length: 7 }, (_, i) => e(`2026-10-0${i + 1}`, 80 - i * 0.1));
  assert.equal(weightTrendSummary(weightPoints(week)).status, 'ok');
  assert.equal(weightTrendSummary(weightPoints(week.slice(0, 6))).status, 'too_early');
  assert.deepEqual([...trendSegments(weightPoints(week))], [0]);
  assert.deepEqual([...trendSegments(weightPoints(week.slice(0, 6)))], []);
});

test('times in different zones order by instant, not by text', () => {
  const pts = weightPoints([
    { id: 'a', kg: 80, day: '2026-10-01', at: '2026-10-01T09:00:00+05:30' },
    { id: 'b', kg: 79, day: '2026-10-01', at: '2026-10-01T04:00:00Z' },
  ]);
  assert.equal(pts[0]!.kg, 79, '04:00Z is 09:30 in India, after 09:00');
});
