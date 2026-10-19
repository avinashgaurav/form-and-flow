import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildCatalogue,
  CATALOGUE,
  dishPerServing,
  NUTRIENT_KEYS,
  SEED_DISHES,
  SEED_INGREDIENTS,
  type DishRecipe,
  type NutrientKey,
} from '../nutrition';

/** Zeros that are true by nature and reported as 0 by the source. Any other 0 would be a missing value typed as zero. */
const TRUE_ZEROS: Record<string, NutrientKey[]> = {
  paneer: ['fibreG'],
  curd: ['fibreG'],
  milk: ['fibreG'],
  ghee: ['proteinG', 'carbG', 'fibreG'],
  oil: ['proteinG', 'carbG', 'fibreG'],
  mustard_oil: ['proteinG', 'carbG', 'fibreG'],
  egg: ['fibreG'],
  chicken: ['carbG', 'fibreG'],
  fish: ['carbG', 'fibreG'],
  prawns: ['carbG'],
  sugar: ['proteinG', 'fatG', 'fibreG'],
  tea: ['proteinG', 'fatG', 'fibreG'],
};

test('catalogue size: about 40 ingredients and 30 dishes', () => {
  assert.ok(SEED_INGREDIENTS.length >= 40, `${SEED_INGREDIENTS.length} ingredients`);
  assert.ok(SEED_DISHES.length >= 30, `${SEED_DISHES.length} dishes`);
  assert.equal(CATALOGUE.ingredients.size, SEED_INGREDIENTS.length);
  assert.equal(CATALOGUE.dishes.size, SEED_DISHES.length);
});

test('IDs are unique within and across ingredients and dishes', () => {
  const ing = SEED_INGREDIENTS.map((i) => i.id);
  const dish = SEED_DISHES.map((d) => d.id);
  assert.equal(new Set(ing).size, ing.length);
  assert.equal(new Set(dish).size, dish.length);
  assert.equal(new Set([...ing, ...dish]).size, ing.length + dish.length);
  for (const id of [...ing, ...dish]) assert.match(id, /^[a-z0-9_]+$/, id);
});

test('every dish ingredient and cooking fat exists', () => {
  for (const d of SEED_DISHES) {
    for (const r of d.ingredients) assert.ok(CATALOGUE.ingredients.has(r.ingredientId), `${d.id} uses ${r.ingredientId}`);
    if (d.oil) assert.ok(CATALOGUE.ingredients.has(d.oil.ingredientId), `${d.id} fat ${d.oil.ingredientId}`);
  }
});

test('no nutrient is silently zero where null is meant, and energy is never zero', () => {
  for (const i of SEED_INGREDIENTS) {
    for (const k of NUTRIENT_KEYS) {
      const v = i.per100g[k];
      assert.ok(v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0), `${i.id}.${k} is a number or null`);
      if (v === 0) assert.ok(TRUE_ZEROS[i.id]?.includes(k), `${i.id}.${k} is 0: use null if unknown, or add it to TRUE_ZEROS if true`);
    }
    assert.ok((i.per100g.energyKcal ?? 0) > 0, `${i.id} has energy`);
  }
  // The null path is exercised by real data: poha fibre is not known, and SR Legacy reports no fibre for raw shrimp.
  assert.equal(CATALOGUE.ingredients.get('poha')!.per100g.fibreG, null);
  assert.equal(CATALOGUE.ingredients.get('prawns')!.per100g.fibreG, null);
});

/** Ingredients SR Legacy has no defensible match for. They keep approximate values and must say so. */
const UNVERIFIED = ['paneer', 'poha'];

test('SR Legacy rows name their food; paneer, poha and every dish stay seed_unverified', () => {
  const fdcIds: number[] = [];
  for (const i of CATALOGUE.ingredients.values()) {
    if (UNVERIFIED.includes(i.id)) {
      assert.deepEqual(i.source, { name: 'USDA FoodData Central', status: 'seed_unverified' }, i.id);
      continue;
    }
    assert.equal(i.source.status, 'usda_sr_legacy', i.id);
    if (i.source.status !== 'usda_sr_legacy') continue;
    assert.equal(i.source.release, 'SR Legacy, April 2018 (public domain)', i.id);
    assert.ok(Number.isInteger(i.source.fdcId) && i.source.fdcId > 0, `${i.id} fdcId`);
    assert.ok(i.source.description.trim().length > 0, `${i.id} description`);
    fdcIds.push(i.source.fdcId);
  }
  assert.equal(new Set(fdcIds).size, fdcIds.length, 'each SR Legacy food is used once');
  assert.equal(fdcIds.length, CATALOGUE.ingredients.size - UNVERIFIED.length);
  // One row pinned to the published values (fdc_id 172436).
  const toor = CATALOGUE.ingredients.get('toor_dal')!;
  assert.deepEqual(toor.source, {
    name: 'USDA FoodData Central',
    status: 'usda_sr_legacy',
    release: 'SR Legacy, April 2018 (public domain)',
    fdcId: 172436,
    description: 'Pigeon peas (red gram), mature seeds, raw',
  });
  assert.deepEqual(toor.per100g, { energyKcal: 343, proteinG: 21.7, fatG: 1.49, carbG: 62.78, fibreG: 15 });
  for (const d of CATALOGUE.dishes.values()) {
    assert.equal(d.source.status, 'seed_unverified', d.id);
    assert.equal(d.quality, 'computed_from_recipe', d.id);
  }
});

test('dishes carry no typed nutrients: values are computed from ingredients', () => {
  for (const d of SEED_DISHES) assert.ok(!('per100g' in d) && !('nutrients' in d), `${d.id} has typed nutrients`);
  // Roti: 30 g atta at 340 kcal/100 g = 102 kcal, plus 1 g ghee at 900 kcal/100 g = 9 kcal.
  const roti = dishPerServing(CATALOGUE.dishes.get('roti')!, 1);
  assert.ok(Math.abs(roti.values.energyKcal! - 111) < 1e-9);
  // Poha fibre is null because poha's fibre is unknown, not zero.
  const poha = dishPerServing(CATALOGUE.dishes.get('kanda_poha')!, 6);
  assert.equal(poha.values.fibreG, null);
  assert.deepEqual(poha.missingFrom.fibreG, ['poha']);
});

test('units have positive gram weights and every default unit resolves', () => {
  for (const f of [...CATALOGUE.ingredients.values(), ...CATALOGUE.dishes.values()]) {
    for (const u of f.units) assert.ok(u.grams > 0, `${f.id} ${u.unit}`);
    assert.ok(f.defaultUnit === 'g' || f.units.some((u) => u.unit === f.defaultUnit), `${f.id} default ${f.defaultUnit}`);
  }
  for (const d of CATALOGUE.dishes.values()) {
    assert.ok(d.servingGrams > 0 && d.yieldServings >= 1, d.id);
    if (d.oil) assert.ok(d.oil.levels.light <= d.oil.levels.normal && d.oil.levels.normal <= d.oil.levels.rich, `${d.id} oil levels in order`);
  }
});

test('diet and allergen tags are derived from every ingredient, optional ones included', () => {
  const poha = CATALOGUE.dishes.get('kanda_poha')!;
  assert.ok(poha.allergenTags.includes('peanut'), 'optional peanuts still tag poha');
  assert.ok(poha.allergenTags.includes('mustard'));
  assert.ok(!poha.dietTags.includes('jain_ok'), 'onion and potato make poha not Jain');
  assert.deepEqual(CATALOGUE.dishes.get('chicken_curry')!.dietTags, ['non_veg']);
  assert.ok(CATALOGUE.dishes.get('chicken_curry')!.allergenTags.includes('milk'), 'curd in the gravy');
  assert.deepEqual(CATALOGUE.dishes.get('fish_curry')!.allergenTags, ['fish', 'mustard'], 'mustard oil is the cooking fat');
  assert.deepEqual(CATALOGUE.dishes.get('roti')!.allergenTags, ['gluten', 'milk'], 'ghee on the roti');
  assert.deepEqual(CATALOGUE.dishes.get('egg_bhurji')!.dietTags, ['egg', 'non_veg']);
  assert.ok(CATALOGUE.dishes.get('dahi')!.dietTags.includes('jain_ok'));
});

test('Hinglish names are present as names or aliases', () => {
  const words = new Set([...CATALOGUE.ingredients.values(), ...CATALOGUE.dishes.values()].flatMap((f) => [f.name.toLowerCase(), ...f.aliases]));
  for (const w of ['dhaniya', 'bhindi', 'chole', 'roti', 'dal', 'chawal', 'kela', 'aloo', 'pyaz']) assert.ok(words.has(w), w);
});

test('buildCatalogue rejects unknown ingredients and duplicate IDs', () => {
  const bad: DishRecipe = { ...SEED_DISHES[0]!, id: 'bad', ingredients: [{ ingredientId: 'unobtainium', grams: 10 }] };
  assert.throws(() => buildCatalogue(SEED_INGREDIENTS, [bad]), /unknown ingredient/);
  assert.throws(() => buildCatalogue([...SEED_INGREDIENTS, SEED_INGREDIENTS[0]!], []), /Duplicate ingredient/);
  assert.throws(() => buildCatalogue(SEED_INGREDIENTS, [SEED_DISHES[0]!, SEED_DISHES[0]!]), /Duplicate dish/);
});
