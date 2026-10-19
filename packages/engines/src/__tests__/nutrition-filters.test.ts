import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CATALOGUE,
  checkLogFood,
  exclusionReasons,
  filterSuggestions,
  foodIngredients,
  isSuggestible,
  matchFreeTextAllergies,
  type AllergenTag,
  type FoodRef,
} from '../nutrition';

const dish = (id: string): FoodRef => ({ kind: 'dish', id });
const ALL_FOODS: FoodRef[] = [
  ...[...CATALOGUE.dishes.keys()].map(dish),
  ...[...CATALOGUE.ingredients.keys()].map((id) => ({ kind: 'ingredient' as const, id })),
];

test('FD-02: an optional ingredient still excludes the dish (peanuts in poha)', () => {
  const reasons = exclusionReasons(dish('kanda_poha'), { allergens: ['peanut'] });
  assert.deepEqual(reasons, [{ code: 'allergen', tag: 'peanut', ingredientId: 'peanuts', optional: true }]);
  assert.equal(isSuggestible(dish('kanda_poha'), { allergens: ['peanut'] }), false);
  assert.equal(isSuggestible(dish('upma'), { allergens: ['tree_nut'] }), false, 'optional cashew in upma');
});

test('FD-02: cooking fat counts too (mustard oil in fish curry)', () => {
  assert.equal(isSuggestible(dish('fish_curry'), { allergens: ['mustard'] }), false);
  assert.equal(isSuggestible(dish('roti'), { allergens: ['milk'] }), false, 'ghee on roti');
});

test('FD-02 property: every food with an allergen in any ingredient is excluded, and no other', () => {
  const tags: AllergenTag[] = ['milk', 'gluten', 'peanut', 'tree_nut', 'soy', 'egg', 'fish', 'shellfish', 'sesame', 'mustard'];
  for (const tag of tags)
    for (const f of ALL_FOODS) {
      const has = foodIngredients(f).some(({ ingredient }) => ingredient.allergenTags.includes(tag));
      assert.equal(isSuggestible(f, { allergens: [tag] }), !has, `${f.id} with ${tag}`);
    }
});

test('free-text allergies match ingredient names and aliases', () => {
  assert.equal(isSuggestible(dish('upma'), { freeTextAllergies: ['Kaju'] }), false);
  assert.equal(isSuggestible(dish('dal_tadka'), { freeTextAllergies: ['lehsun'] }), false, 'garlic by its Hindi name');
  assert.equal(isSuggestible(dish('roti'), { freeTextAllergies: ['lehsun'] }), true);
  assert.equal(isSuggestible(dish('paneer_bhurji'), { freeTextAllergies: ['dairy'] }), false, 'allergen group word');
  assert.equal(isSuggestible(dish('kanda_poha'), { freeTextAllergies: ['nuts'] }), false, '"nuts" covers peanuts too');
  assert.deepEqual(matchFreeTextAllergies(['dahi']).ingredientIds, ['curd'], 'curd by its Hindi name');
  assert.equal(isSuggestible(dish('raita'), { freeTextAllergies: ['dahi'] }), false);
  const m = matchFreeTextAllergies(['kaju', 'peanuts', 'brinjal']);
  assert.deepEqual(m.ingredientIds, ['cashew', 'peanuts']);
  assert.deepEqual(m.unrecognised, ['brinjal'], 'unmatched text is reported, not ignored');
});

test('logging a food with a declared allergen is allowed but warns', () => {
  const c = checkLogFood(dish('kanda_poha'), { allergens: ['peanut'] });
  assert.equal(c.allowed, true);
  assert.equal(c.warning, true);
  assert.equal(c.reasons[0]?.code, 'allergen');
  assert.deepEqual(checkLogFood(dish('roti'), { allergens: ['peanut'] }), { allowed: true, warning: false, reasons: [] });
  // Diet is a preference, not a warning, when logging what was eaten.
  assert.equal(checkLogFood(dish('chicken_curry'), { diet: 'veg' }).warning, false);
});

test('diet and Jain filters for suggestions', () => {
  assert.equal(isSuggestible(dish('chicken_curry'), { diet: 'veg' }), false);
  assert.equal(isSuggestible(dish('egg_bhurji'), { diet: 'veg' }), false);
  assert.equal(isSuggestible(dish('egg_bhurji'), { diet: 'egg' }), true);
  assert.equal(isSuggestible(dish('dahi'), { diet: 'vegan' }), false);
  assert.equal(isSuggestible(dish('dahi'), { diet: 'veg', jain: true }), true);
  assert.equal(isSuggestible(dish('aloo_gobi'), { jain: true }), false, 'potato and onion');
  assert.deepEqual(exclusionReasons(dish('aloo_gobi'), { jain: true }), [{ code: 'jain' }]);
});

test('filterSuggestions keeps order and drops excluded foods', () => {
  const out = filterSuggestions([dish('roti'), dish('kanda_poha'), dish('idli'), dish('upma')], { allergens: ['peanut', 'tree_nut'] });
  assert.deepEqual(out.map((f) => f.id), ['roti', 'idli']);
  assert.deepEqual(exclusionReasons({ kind: 'dish', id: 'nope' }, {}), [{ code: 'unknown_food' }]);
});
