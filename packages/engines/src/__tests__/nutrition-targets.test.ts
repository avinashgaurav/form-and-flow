import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeTargets, fatLossRate, NUTRITION_NEEDS_REVIEW, restingEnergy, roundKcalRange, type NumericTargets, type TargetInput } from '../nutrition';

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);

const MAN: TargetInput = { sex: 'male', ageYears: 30, heightCm: 175, weightKg: 70, activity: 'moderate', goal: 'maintenance', restrictions: [] };

function numeric(input: TargetInput): NumericTargets {
  const t = computeTargets(input);
  assert.equal(t.mode, 'numeric');
  return t as NumericTargets;
}

test('EN-01 Mifflin-St Jeor resting energy, with the average for prefer not to say', () => {
  // Men: 10*70 + 6.25*175 - 5*30 + 5 = 700 + 1093.75 - 150 + 5 = 1648.75
  near(restingEnergy('male', 70, 175, 30), 1648.75);
  // Women: same minus 166 (161 + 5) = 1482.75
  near(restingEnergy('female', 70, 175, 30), 1482.75);
  // Average constant (5 - 161) / 2 = -78: 1565.75
  near(restingEnergy('prefer_not_to_say', 70, 175, 30), 1565.75);
});

test('EN-01 maintenance is a range of plus or minus 10 per cent, with the activity factor labelled', () => {
  // 1648.75 * 1.55 = 2555.5625; range 2300.00625 to 2811.11875
  const t = numeric(MAN);
  const e = t.energy!;
  near(e.restingKcal, 1648.75);
  near(e.maintenanceKcal.low, 2300.00625);
  near(e.maintenanceKcal.high, 2811.11875);
  assert.deepEqual(e.kcal, e.maintenanceKcal);
  assert.ok(e.kcal.low < e.kcal.high, 'a range, never a single number');
  assert.ok(e.assumptions.some((a) => a.includes('Activity factor 1.55') && a.includes('assumption')));
  assert.ok(e.ruleIds.includes('EN-01'));
  assert.equal(e.change.kind, 'none');
});

test('EN-02 fat loss defaults to 0.5 kg a week', () => {
  // Man 35 y, 180 cm, 80 kg: resting 800 + 1125 - 175 + 5 = 1755; * 1.55 = 2720.25
  // Deficit 0.5 * 7700 / 7 = 550: target 2448.225 - 550 = 1898.225 to 2992.275 - 550 = 2442.275
  const t = numeric({ ...MAN, ageYears: 35, heightCm: 180, weightKg: 80, goal: 'fat_loss' });
  const e = t.energy!;
  near(e.kcal.low, 1898.225);
  near(e.kcal.high, 2442.275);
  assert.deepEqual(e.change, { kind: 'deficit', kcalPerDay: { low: 550, high: 550 } });
  assert.equal(e.floorApplied, false);
  assert.ok(e.ruleIds.includes('EN-02'));
  assert.ok(e.assumptions.some((a) => a.includes('7700 kcal per kg') && a.includes('approximation')));
});

test('EN-02 cap: the lower of 1 kg and 1 per cent of body weight a week', () => {
  near(fatLossRate(80, 1.5), 0.8);
  near(fatLossRate(120, 1.5), 1);
  near(fatLossRate(45), 0.45, 1e-9);
  near(fatLossRate(80), 0.5);
  const t = numeric({ ...MAN, weightKg: 80, goal: 'fat_loss', lossKgPerWeek: 1.5 });
  near(t.energy!.change.kcalPerDay.low, (0.8 * 7700) / 7);
  assert.ok(t.reasons.some((r) => r.ruleId === 'EN-02' && r.text.includes('capped')));
});

test('EN-03 the target never goes below resting energy and stays a range', () => {
  // Woman 30 y, 158 cm, 58 kg: 580 + 987.5 - 150 - 161 = 1256.5. Low activity: * 1.2 = 1507.8.
  // Maintenance 1357.02 to 1658.58; minus 550 gives 807.02 to 1108.58, both under 1256.5.
  // So the target is resting energy up to the low end of maintenance: 1256.5 to 1357.02.
  const t = numeric({ sex: 'female', ageYears: 30, heightCm: 158, weightKg: 58, activity: 'low', goal: 'fat_loss', restrictions: [] });
  const e = t.energy!;
  near(e.kcal.low, 1256.5);
  near(e.kcal.high, 1357.02);
  assert.equal(e.floorApplied, true);
  assert.ok(e.kcal.low >= e.restingKcal);
  assert.ok(t.reasons.some((r) => r.ruleId === 'EN-03'));
  assert.ok(t.needsReview.includes('EN-03 energy floor'));
});

test('EN-03 holds for any input: lower bound never below resting energy', () => {
  for (const sex of ['male', 'female', 'prefer_not_to_say'] as const)
    for (const activity of ['low', 'light', 'moderate', 'high'] as const)
      for (const weightKg of [40, 60, 90, 140])
        for (const goal of ['fat_loss', 'muscle_gain', 'maintenance'] as const) {
          const e = numeric({ sex, ageYears: 40, heightCm: 165, weightKg, activity, goal, restrictions: [], lossKgPerWeek: 1 }).energy!;
          assert.ok(e.kcal.low >= e.restingKcal - 1e-9, `${sex} ${activity} ${weightKg} ${goal}`);
          assert.ok(e.kcal.high > e.kcal.low, `range for ${sex} ${activity} ${weightKg} ${goal}`);
        }
});

test('EN-05 muscle gain: small surplus for 0.5 to 1 per cent of body weight a month', () => {
  // 70 kg: 0.005 * 70 * 7700 / 30.4375 = 88.5421; 0.01 * 70 * 7700 / 30.4375 = 177.0842
  const t = numeric({ ...MAN, goal: 'muscle_gain', experience: '6to24m' });
  const e = t.energy!;
  near(e.change.kcalPerDay.low, 88.5421, 1e-4);
  near(e.change.kcalPerDay.high, 177.0842, 1e-4);
  near(e.kcal.low, e.maintenanceKcal.low + e.change.kcalPerDay.low);
  near(e.kcal.high, e.maintenanceKcal.high + e.change.kcalPerDay.high);
  assert.ok(e.ruleIds.includes('EN-05'));
  assert.ok(t.needsReview.includes('EN-05 muscle-gain surplus'));
  // Beginners up to 1.5 per cent: 0.015 * 70 * 7700 / 30.4375 = 265.6263
  near(numeric({ ...MAN, goal: 'muscle_gain', experience: 'none' }).energy!.change.kcalPerDay.high, 265.6263, 1e-4);
});

test('EN-08 no_deficit means maintenance only', () => {
  for (const goal of ['fat_loss', 'muscle_gain'] as const) {
    const t = numeric({ ...MAN, goal, restrictions: [{ code: 'no_deficit', source: 'assessment' }] });
    assert.deepEqual(t.energy!.kcal, t.energy!.maintenanceKcal);
    assert.equal(t.energy!.change.kind, 'none');
    assert.ok(t.energy!.ruleIds.includes('EN-08'));
    assert.ok(!t.energy!.ruleIds.includes('EN-02') && !t.energy!.ruleIds.includes('EN-05'));
  }
});

test('PR-01 floor of 0.83 g/kg when not training and not in a deficit', () => {
  const p = numeric(MAN).protein!;
  assert.equal(p.kind, 'floor');
  assert.equal(p.grams.default, 59); // 0.83 x 70 kg = 58.1; an "at least" rounds up to whole grams
  assert.equal(p.gPerKg.high, null);
  assert.deepEqual(p.ruleIds, ['PR-01']);
});

test('PR-02 default 1.6 g/kg, range 1.4 to 2.0, for training goals, a deficit or a training plan', () => {
  for (const input of [{ ...MAN, goal: 'muscle_gain' as const }, { ...MAN, goal: 'strength' as const }, { ...MAN, goal: 'fat_loss' as const }, { ...MAN, resistanceTraining: true }]) {
    const p = numeric(input).protein!;
    assert.equal(p.kind, 'range');
    assert.deepEqual(p.gPerKg, { low: 1.4, default: 1.6, high: 2.0 });
    near(p.grams.low, 98);
    near(p.grams.default, 112);
    near(p.grams.high!, 140);
    assert.ok(p.ruleIds.includes('PR-02'));
  }
});

test('PR-04 no_high_protein caps protein at the PR-01 level', () => {
  const t = numeric({ ...MAN, goal: 'muscle_gain', restrictions: [{ code: 'no_high_protein', source: 'assessment' }] });
  const p = t.protein!;
  assert.equal(p.kind, 'cap');
  assert.deepEqual(p.gPerKg, { low: 0.83, default: 0.83, high: 0.83 });
  assert.ok(p.ruleIds.includes('PR-04'));
  assert.ok(t.reasons.some((r) => r.ruleId === 'PR-04'));
});

test('FB-01 no fibre target', () => {
  const t = numeric(MAN);
  assert.equal(t.fibre.target, null);
  assert.ok(t.fibre.note.length > 0);
  assert.deepEqual(t.fibre.ruleIds, ['FB-01']);
  assert.ok(t.ruleIds.includes('FB-01'));
});

/** Every number-typed value, and every digit outside a rule ID, anywhere in the output. */
function numbersIn(value: unknown, path = ''): string[] {
  if (typeof value === 'number') return [path];
  if (typeof value === 'string') return /\d/.test(value) && !/^[A-Z]{2}-\d{2}\b/.test(value) ? [`${path}: ${value}`] : [];
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => numbersIn(v, `${path}.${k}`));
  return [];
}

test('FD-01 non-numeric mode returns plate guidance and no numbers at all', () => {
  for (const input of [
    { ...MAN, goal: 'fat_loss' as const, restrictions: [{ code: 'non_numeric_only' as const, source: 'assessment' as const }] },
    { ...MAN, goal: 'muscle_gain' as const, preferNonNumeric: true },
  ]) {
    const t = computeTargets(input);
    assert.equal(t.mode, 'non_numeric');
    assert.deepEqual(numbersIn(t), []);
    assert.ok(!('energy' in t) && !('protein' in t));
    if (t.mode === 'non_numeric') {
      assert.deepEqual(t.plate.map((p) => p.share), ['half', 'quarter', 'quarter']);
      assert.ok(t.plate[1]!.examples.includes('dal') && t.plate[1]!.examples.includes('paneer'));
      assert.match(t.proteinPerMeal, /palm/);
      assert.ok(t.ruleIds.includes('FD-01'));
    }
  }
});

test('missing weight returns null with a reason, never a guess', () => {
  const t = numeric({ ...MAN, weightKg: null, goal: 'fat_loss' });
  assert.equal(t.energy, null);
  assert.match(t.energyReason!, /weight/);
  assert.equal(t.protein, null);
  assert.match(t.proteinReason!, /weight/);
  // Missing height still allows a protein target from weight.
  const h = numeric({ ...MAN, heightCm: null });
  assert.equal(h.energy, null);
  assert.match(h.energyReason!, /height/);
  assert.ok(h.protein);
  // Out-of-range values are not estimated either.
  assert.equal(numeric({ ...MAN, weightKg: 20 }).energy, null);
  assert.equal(numeric({ ...MAN, ageYears: 16 }).energy, null);
});

test('needsReview names EN-03 floor, EN-05, PR-03 and PR-05', () => {
  const all = NUTRITION_NEEDS_REVIEW.join(' | ');
  for (const id of ['EN-03', 'EN-05', 'PR-03', 'PR-05']) assert.ok(all.includes(id), id);
});

test('the shown energy range is whole tens and never outside the computed range', () => {
  for (const r of [{ low: 1256.5, high: 1357.02 }, { low: 1965.83, high: 2471.547 }, { low: 2000, high: 2000 }, { low: 1501, high: 1509 }]) {
    const d = roundKcalRange(r);
    assert.equal(d.low % 10, 0);
    assert.equal(d.high % 10, 0);
    if (r.high - r.low >= 10) assert.ok(d.low >= r.low && d.high <= r.high, JSON.stringify(r));
  }
  assert.deepEqual(roundKcalRange({ low: 1965.83, high: 2471.547 }), { low: 1970, high: 2470 });
});

test('protein grams are whole numbers rounded inward for every whole-kg weight', () => {
  for (let w = 40; w <= 120; w++) {
    const t = computeTargets({ sex: 'female', ageYears: 30, heightCm: 165, weightKg: w, activity: 'light', goal: 'muscle_gain', restrictions: [], resistanceTraining: true });
    const p = (t as NumericTargets).protein!;
    for (const v of [p.grams.low, p.grams.default, p.grams.high]) if (v !== null) assert.ok(Number.isInteger(v), `${w} kg gives ${v}`);
    assert.ok(p.grams.low >= p.gPerKg.low * w - 1e-9 && (p.grams.high === null || p.grams.high <= p.gPerKg.high! * w + 1e-9));
  }
});

test('a protein cap never shows a number above itself', () => {
  const t = computeTargets({ sex: 'male', ageYears: 35, heightCm: 175, weightKg: 70, activity: 'light', goal: 'muscle_gain', restrictions: [{ code: 'no_high_protein', source: 'assessment' }], resistanceTraining: true });
  const p = (t as NumericTargets).protein!;
  assert.equal(p.kind, 'cap');
  assert.deepEqual([p.grams.low, p.grams.default, p.grams.high], [58, 58, 58]);
});
