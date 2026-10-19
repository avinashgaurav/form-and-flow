import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCatalogue,
  itemTotals,
  roundEstimate,
  roundForDisplay,
  SEED_DISHES,
  SEED_INGREDIENTS,
  snapshot,
  sumTotals,
  type DishRecipe,
  type NutrientTotal,
} from '../nutrition';

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`);
function complete(n: NutrientTotal) {
  assert.equal(n.status, 'complete');
  return n as Extract<NutrientTotal, { status: 'complete' }>;
}

test('household units: 2 roti, oil level not chosen, light to rich range', () => {
  // One roti = 30 g atta = 340 * 0.30 = 102 kcal. Ghee is 9 kcal/g; light 0 g, normal 1 g, rich 4 g.
  // mid  = 2 * (102 + 1 * 9)               = 222
  // low  = 2 * 0.85 * (102 + 0)            = 173.4
  // high = 2 * 1.15 * (102 + 4 * 9)        = 2.3 * 138 = 317.4
  const t = itemTotals({ food: { kind: 'dish', id: 'roti' }, quantity: 2, unit: 'piece' });
  const e = complete(t.nutrients.energyKcal);
  near(e.mid, 222);
  near(e.low, 173.4);
  near(e.high, 317.4);
  // Protein: atta 13.21 * 0.30 = 3.963 g; ghee has none.
  // mid 2 * 3.963 = 7.926; low 1.7 * 3.963 = 6.7371; high 2.3 * 3.963 = 9.1149
  const p = complete(t.nutrients.proteinG);
  near(p.mid, 7.926);
  near(p.low, 6.7371);
  near(p.high, 9.1149);
  assert.equal(t.basis, 'household');
  assert.equal(t.confidence, 'high');
  assert.deepEqual(t.grams, { mid: 80, low: 68, high: 92 });
  // Oil grams: mid 2 * 1, low 1.7 * 0, high 2.3 * 4
  assert.deepEqual(t.oilGrams, { mid: 2, low: 0, high: 9.2 });
});

test('grams: 100 g paneer is plus or minus 5 per cent', () => {
  // 296 kcal per 100 g: 296 * 0.95 = 281.2, 296 * 1.05 = 310.8
  const t = itemTotals({ food: { kind: 'ingredient', id: 'paneer' }, quantity: 100, unit: 'g' });
  const e = complete(t.nutrients.energyKcal);
  near(e.mid, 296);
  near(e.low, 281.2);
  near(e.high, 310.8);
  assert.equal(t.basis, 'measured');
  assert.equal(t.oilGrams, null);
});

test('chosen oil level: 1 katori dal tadka, normal oil, plus or minus 20 per cent of oil', () => {
  // Recipe for 4: toor 120 g (411.6), onion 40 (16), tomato 60 (10.8), garlic 8 (11.92), chilli 4 (1.6), coriander 4 (0.92)
  // = 452.84 kcal, so 113.21 per serving. 1 katori = 150 g = 1 serving.
  // Oil 6 g * 8.84 = 53.04; chosen range 4.8 g (42.432) to 7.2 g (63.648).
  // mid  = 113.21 + 53.04                 = 166.25
  // low  = 0.85 * (113.21 + 42.432)       = 132.2957
  // high = 1.15 * (113.21 + 63.648)       = 203.3867
  const t = itemTotals({ food: { kind: 'dish', id: 'dal_tadka' }, quantity: 1, unit: 'katori', oilLevel: 'normal' });
  const e = complete(t.nutrients.energyKcal);
  near(e.mid, 166.25, 1e-6);
  near(e.low, 132.2957, 1e-6);
  near(e.high, 203.3867, 1e-6);
  // Oil grams: mid 6, low 0.85 * 4.8 = 4.08, high 1.15 * 7.2 = 8.28
  near(t.oilGrams!.mid, 6);
  near(t.oilGrams!.low, 4.08);
  near(t.oilGrams!.high, 8.28);
});

test('half plate rice: 125 g of a 150 g serving', () => {
  // Plate = 250 g, so 125 g = 0.8333 servings of 50 g raw rice (182.5 kcal).
  // mid 152.0833, low * 0.85 = 129.2708, high * 1.15 = 174.8958
  const e = complete(itemTotals({ food: { kind: 'dish', id: 'plain_rice' }, quantity: 0.5, unit: 'plate' }).nutrients.energyKcal);
  near(e.mid, 152.0833, 1e-4);
  near(e.low, 129.2708, 1e-4);
  near(e.high, 174.8958, 1e-4);
});

test('a missing nutrient propagates as incomplete, never zero', () => {
  const poha = itemTotals({ food: { kind: 'dish', id: 'kanda_poha' }, quantity: 1, unit: 'plate' });
  const fibre = poha.nutrients.fibreG;
  assert.equal(fibre.status, 'incomplete');
  if (fibre.status === 'incomplete') {
    assert.deepEqual(fibre.missingFrom, ['poha']);
    assert.ok(fibre.knownPart.mid > 0, 'known part is kept separately as a floor');
  }
  assert.equal(poha.nutrients.energyKcal.status, 'complete');
  const roti = itemTotals({ food: { kind: 'dish', id: 'roti' }, quantity: 2, unit: 'piece' });
  const day = sumTotals([roti, poha]);
  assert.equal(day.fibreG.status, 'incomplete');
  assert.equal(day.energyKcal.status, 'complete');
  near(complete(day.energyKcal).mid, complete(roti.nutrients.energyKcal).mid + complete(poha.nutrients.energyKcal).mid);
  // Raw poha on its own: fibre is incomplete with nothing known, not a zero total.
  const raw = itemTotals({ food: { kind: 'ingredient', id: 'poha' }, quantity: 50, unit: 'g' });
  assert.equal(raw.nutrients.fibreG.status, 'incomplete');
});

test('an unknown unit gives low confidence and no numbers', () => {
  const t = itemTotals({ food: { kind: 'dish', id: 'roti' }, quantity: 2, unit: 'katori' });
  assert.equal(t.basis, 'unknown_unit');
  assert.equal(t.confidence, 'low');
  assert.equal(t.grams, null);
  for (const n of Object.values(t.nutrients)) assert.equal(n.status, 'incomplete');
  assert.throws(() => itemTotals({ food: { kind: 'dish', id: 'roti' }, quantity: 0, unit: 'piece' }), RangeError);
});

test('sumTotals of nothing is a complete zero', () => {
  assert.deepEqual(sumTotals([]).energyKcal, { status: 'complete', mid: 0, low: 0, high: 0 });
});

test('editing a dish later never changes a stored snapshot', () => {
  const recipes: DishRecipe[] = JSON.parse(JSON.stringify(SEED_DISHES));
  const v1 = buildCatalogue(SEED_INGREDIENTS, recipes);
  const item = { food: { kind: 'dish' as const, id: 'roti' }, quantity: 2, unit: 'piece' as const };
  const snap = snapshot(item, v1);
  const before = JSON.stringify(snap);
  near(complete(snap.nutrients.energyKcal).mid, 222);

  // A reviewer changes the roti to 40 g of atta, in a new catalogue version and in place.
  const edited = recipes.map((r) => (r.id === 'roti' ? { ...r, ingredients: [{ ingredientId: 'atta', grams: 40 }] } : r));
  const v2 = buildCatalogue(SEED_INGREDIENTS, edited);
  near(complete(itemTotals(item, v2).nutrients.energyKcal).mid, 2 * (136 + 9));
  v1.dishes.get('roti')!.ingredients[0]!.grams = 45;
  assert.notEqual(complete(itemTotals(item, v1).nutrients.energyKcal).mid, 222);

  assert.equal(JSON.stringify(snap), before);
  assert.ok(Object.isFrozen(snap) && Object.isFrozen(snap.nutrients.energyKcal));
  assert.equal(snap.sourceStatus, 'seed_unverified', 'dish recipes are unreviewed');
  assert.equal(snapshot({ food: { kind: 'ingredient', id: 'milk' }, quantity: 1, unit: 'glass' }).sourceStatus, 'usda_sr_legacy');
  assert.equal(snap.foodName, 'Roti');
  // Snapshots add up like live items.
  assert.equal(sumTotals([snap, snap]).energyKcal.status, 'complete');
});

test('rounding is for display only', () => {
  assert.equal(roundForDisplay('energyKcal', 221.52), 220);
  assert.equal(roundForDisplay('proteinG', 7.926), 7.9);
  assert.equal(roundForDisplay('proteinG', 17.6), 18);
  assert.deepEqual(roundEstimate('energyKcal', { mid: 221.52, low: 173.4, high: 315.192 }), { mid: 220, low: 175, high: 315 });
  const t = itemTotals({ food: { kind: 'dish', id: 'roti' }, quantity: 2, unit: 'piece' });
  near(complete(t.nutrients.energyKcal).mid, 222);
});
