import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adaptiveUpdate, trendWeights, type AdaptiveInput, type DayIntake, type WeighIn } from '../nutrition';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10);

/** n consecutive days from 1 October, with intake and a weigh-in each day unless skipped. */
function history(n: number, opts: { kcal?: (i: number) => number; kg?: (i: number) => number; skipIntake?: number[]; skipWeigh?: number[] } = {}) {
  const intake: DayIntake[] = [];
  const weighIns: WeighIn[] = [];
  for (let i = 0; i < n; i++) {
    if (!opts.skipIntake?.includes(i)) intake.push({ day: day(i), kcal: opts.kcal?.(i) ?? 2200 });
    if (!opts.skipWeigh?.includes(i)) weighIns.push({ day: day(i), kg: opts.kg?.(i) ?? 70 });
  }
  return { intake, weighIns };
}

const base = (n: number, h: ReturnType<typeof history>): AdaptiveInput => ({ ...h, today: day(n), currentTargetKcal: 1800, goalDeltaKcal: -500 });

test('trend weight is an EWMA with alpha 0.1, same-day weigh-ins averaged', () => {
  const t = trendWeights([{ day: day(0), kg: 70 }, { day: day(1), kg: 71 }, { day: day(1), kg: 73 }]);
  // Day 0: 70. Day 1: mean 72, so 70 + 0.1 * (72 - 70) = 70.2
  assert.deepEqual(t.map((x) => x.trendKg), [70, 70.2]);
});

test('insufficient data: under 14 days of history', () => {
  const r = adaptiveUpdate(base(13, history(13)));
  assert.equal(r.status, 'insufficient_data');
  assert.equal(r.targetKcal, 1800, 'target unchanged');
  if (r.status === 'insufficient_data') assert.match(r.reason, /14/);
});

test('insufficient data: under 10 logged days', () => {
  const r = adaptiveUpdate(base(14, history(14, { skipIntake: [1, 3, 5, 7, 9] })));
  assert.equal(r.status, 'insufficient_data');
  if (r.status === 'insufficient_data') assert.match(r.reason, /logged days/);
});

test('insufficient data: under 8 weigh-ins', () => {
  const r = adaptiveUpdate(base(14, history(14, { skipWeigh: [0, 1, 2, 3, 4, 5, 6] })));
  assert.equal(r.status, 'insufficient_data');
  if (r.status === 'insufficient_data') assert.match(r.reason, /weigh-ins/);
});

test('EN-06 insufficient data: logging on under 70 per cent of days', () => {
  // 20 days, 12 logged = 60 per cent.
  const r = adaptiveUpdate(base(20, history(20, { skipIntake: [1, 3, 5, 7, 9, 11, 13, 15] })));
  assert.equal(r.status, 'insufficient_data');
  if (r.status === 'insufficient_data') assert.match(r.reason, /70 per cent/);
});

test('steady weight: expenditure equals average intake, target is expenditure plus the goal', () => {
  // 21 days at 2,200 kcal, weight flat at 70 kg: slope 0, expenditure 2,200, proposed 2,200 - 500 = 1,700.
  // Current target 1,800 allows 1,620 to 1,980, so 1,700 stands.
  const r = adaptiveUpdate(base(21, history(21)));
  assert.equal(r.status, 'updated');
  if (r.status !== 'updated') return;
  near(r.trendSlopeKgPerDay, 0);
  near(r.expenditureKcal, 2200);
  near(r.targetKcal, 1700);
  assert.equal(r.capped, false);
  assert.deepEqual(r.ruleIds, ['EN-04', 'EN-07']);
});

test('unlogged days are left out, never counted as zero', () => {
  // 2,000 kcal on 12 of 14 days: the average is 2,000, not 2,000 * 12 / 14.
  const r = adaptiveUpdate(base(14, history(14, { kcal: () => 2000, skipIntake: [4, 9] })));
  assert.equal(r.status, 'updated');
  if (r.status === 'updated') near(r.averageIntakeKcal, 2000);
});

test('losing weight raises the expenditure estimate above intake', () => {
  const r = adaptiveUpdate(base(21, history(21, { kcal: () => 2000, kg: (i) => 80 - 0.1 * i })));
  assert.equal(r.status, 'updated');
  if (r.status !== 'updated') return;
  assert.ok(r.trendSlopeKgPerDay < 0);
  near(r.expenditureKcal, 2000 - r.trendSlopeKgPerDay * 7700);
});

test('weekly change is capped at 10 per cent, and the EN-03 floor wins', () => {
  // Proposed 1,700 against a current 2,000: the cap allows 1,800 at the lowest.
  const capped = adaptiveUpdate({ ...base(21, history(21)), currentTargetKcal: 2000 });
  assert.equal(capped.status, 'updated');
  if (capped.status === 'updated') {
    near(capped.targetKcal, 1800);
    assert.equal(capped.capped, true);
  }
  const floored = adaptiveUpdate({ ...base(21, history(21)), floorKcal: 1750 });
  assert.equal(floored.status, 'updated');
  if (floored.status === 'updated') {
    near(floored.targetKcal, 1750);
    assert.ok(floored.ruleIds.includes('EN-03'));
  }
});

test('EN-07: one high-intake day does not change tomorrow\'s target', () => {
  // Weekly update on day 21 sets the target.
  const h = history(21);
  const update = adaptiveUpdate(base(21, h));
  assert.equal(update.status, 'updated');
  const target = update.targetKcal;

  // Day 21 is a 4,500 kcal wedding and the scale jumps 1.5 kg the next morning.
  const after = {
    intake: [...h.intake, { day: day(21), kcal: 4500 }],
    weighIns: [...h.weighIns, { day: day(21), kg: 70 }, { day: day(22), kg: 71.5 }],
  };
  const tomorrow = adaptiveUpdate({ ...after, today: day(22), currentTargetKcal: target, goalDeltaKcal: -500, lastUpdateDay: day(21) });
  assert.equal(tomorrow.status, 'not_due');
  assert.equal(tomorrow.targetKcal, target);
  if (tomorrow.status === 'not_due') assert.equal(tomorrow.nextUpdateDay, day(28));
});

test('EN-07: at the weekly update, a single big day never lowers the target', () => {
  const plain = adaptiveUpdate(base(21, history(21)));
  const withFeast = adaptiveUpdate(base(21, history(21, { kcal: (i) => (i === 18 ? 4500 : 2200) })));
  assert.ok(plain.status === 'updated' && withFeast.status === 'updated');
  assert.ok(withFeast.targetKcal >= plain.targetKcal, 'no next-day restriction to compensate');
});
