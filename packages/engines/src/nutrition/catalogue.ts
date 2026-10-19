/**
 * Food catalogue types and the dish maths (plan/12 section 3.4).
 *
 * SOURCE STATUS: most ingredient values in seed-ingredients.ts are copied from USDA FoodData Central
 * SR Legacy (April 2018, public domain, claim T-10) and carry status 'usda_sr_legacy' with the fdc_id
 * they came from. The rest are approximations written from general knowledge with status
 * 'seed_unverified'; never present those as verified. Dishes stay 'seed_unverified' because their
 * recipes, serving weights and oil levels are unreviewed assumptions.
 *
 * Dish nutrients are never typed in: they are computed here from the recipe's ingredients.
 */

import { SEED_DISHES } from './seed-dishes';
import { SEED_INGREDIENTS, SEED_SOURCE } from './seed-ingredients';

export type AllergenTag = 'milk' | 'gluten' | 'peanut' | 'tree_nut' | 'soy' | 'egg' | 'fish' | 'shellfish' | 'sesame' | 'mustard';

/** Diets a food suits. A dish suits a diet only if every ingredient does, optional ones included. */
export type DietTag = 'vegan' | 'veg' | 'egg' | 'non_veg' | 'jain_ok';

export type NutrientKey = 'energyKcal' | 'proteinG' | 'fatG' | 'carbG' | 'fibreG';
export const NUTRIENT_KEYS: readonly NutrientKey[] = ['energyKcal', 'proteinG', 'fatG', 'carbG', 'fibreG'];

/** Per 100 g. A missing value is null, never 0. */
export type Nutrients = Record<NutrientKey, number | null>;

export type NutritionSource =
  /** Approximation written from general knowledge, not checked against any source. */
  | { name: 'USDA FoodData Central'; status: 'seed_unverified' }
  /** Per-100 g values copied unrounded from one SR Legacy food, named by its fdc_id and exact description. */
  | {
      name: 'USDA FoodData Central';
      status: 'usda_sr_legacy';
      release: 'SR Legacy, April 2018 (public domain)';
      fdcId: number;
      description: string;
    };

export type FoodUnit = 'katori' | 'plate' | 'piece' | 'glass' | 'cup' | 'tbsp' | 'tsp' | 'g' | 'ml' | 'serving';

/** A household unit and its weight in grams. "1 katori dal = 150 g" is an assumption until reviewed. */
export interface ServingUnit {
  unit: FoodUnit;
  grams: number;
}

export interface Ingredient {
  id: string;
  name: string;
  aliases: string[];
  allergenTags: AllergenTag[];
  dietTags: DietTag[];
  per100g: Nutrients;
  /** Household units on top of grams, which always work. */
  units: ServingUnit[];
  defaultUnit: FoodUnit;
  source: NutritionSource;
}

export type OilLevel = 'light' | 'normal' | 'rich';

export interface RecipeItem {
  ingredientId: string;
  /** Raw grams for the whole stated yield. */
  grams: number;
  /** Optional items never change a dish's identity, but still count for allergens (FD-02). */
  optional?: boolean;
}

/** What a person writes down. Tags and nutrients are derived, never typed. */
export interface DishRecipe {
  id: string;
  name: string;
  aliases: string[];
  /** Ingredient grams are for this many servings; scaled at read time. */
  yieldServings: number;
  /** Cooked weight of one serving in grams. Links household units to the recipe. */
  servingGrams: number;
  ingredients: RecipeItem[];
  /** Cooking fat added per serving, by oil level, in grams. Null for dishes cooked without fat. */
  oil: { ingredientId: string; levels: Record<OilLevel, number> } | null;
  units: ServingUnit[];
  defaultUnit: FoodUnit;
}

export interface Dish extends DishRecipe {
  dietTags: DietTag[];
  allergenTags: AllergenTag[];
  quality: 'computed_from_recipe';
  source: NutritionSource;
}

export interface FoodRef {
  kind: 'dish' | 'ingredient';
  id: string;
}

export interface Catalogue {
  ingredients: ReadonlyMap<string, Ingredient>;
  dishes: ReadonlyMap<string, Dish>;
}

const ALL_DIETS: DietTag[] = ['vegan', 'veg', 'egg', 'non_veg', 'jain_ok'];

/** Ingredients of a recipe including its cooking fat, each flagged optional or not. */
function recipeIngredientIds(recipe: DishRecipe): { ingredientId: string; optional: boolean }[] {
  const out = recipe.ingredients.map((r) => ({ ingredientId: r.ingredientId, optional: r.optional === true }));
  if (recipe.oil) out.push({ ingredientId: recipe.oil.ingredientId, optional: false });
  return out;
}

/** Derive diet and allergen tags from every ingredient, optional ones included. Throws on an unknown ingredient. */
export function defineDish(recipe: DishRecipe, ingredients: ReadonlyMap<string, Ingredient>): Dish {
  let diets = new Set<DietTag>(ALL_DIETS);
  const allergens = new Set<AllergenTag>();
  for (const { ingredientId } of recipeIngredientIds(recipe)) {
    const ing = ingredients.get(ingredientId);
    if (!ing) throw new Error(`Dish ${recipe.id} uses unknown ingredient ${ingredientId}`);
    diets = new Set([...diets].filter((d) => ing.dietTags.includes(d)));
    for (const a of ing.allergenTags) allergens.add(a);
  }
  return {
    ...recipe,
    dietTags: ALL_DIETS.filter((d) => diets.has(d)),
    allergenTags: [...allergens].sort(),
    quality: 'computed_from_recipe',
    source: SEED_SOURCE,
  };
}

/** Build lookup maps. Throws on duplicate IDs or a dish that names an unknown ingredient. */
export function buildCatalogue(ingredients: Ingredient[], recipes: DishRecipe[]): Catalogue {
  const ingMap = new Map<string, Ingredient>();
  for (const i of ingredients) {
    if (ingMap.has(i.id)) throw new Error(`Duplicate ingredient id ${i.id}`);
    ingMap.set(i.id, i);
  }
  const dishMap = new Map<string, Dish>();
  for (const r of recipes) {
    if (dishMap.has(r.id)) throw new Error(`Duplicate dish id ${r.id}`);
    dishMap.set(r.id, defineDish(r, ingMap));
  }
  return { ingredients: ingMap, dishes: dishMap };
}

export const CATALOGUE: Catalogue = buildCatalogue(SEED_INGREDIENTS, SEED_DISHES);

export function getIngredient(id: string, catalogue: Catalogue = CATALOGUE): Ingredient | undefined {
  return catalogue.ingredients.get(id);
}

export function getDish(id: string, catalogue: Catalogue = CATALOGUE): Dish | undefined {
  return catalogue.dishes.get(id);
}

export function getFood(ref: FoodRef, catalogue: Catalogue = CATALOGUE): Ingredient | Dish | undefined {
  return ref.kind === 'dish' ? catalogue.dishes.get(ref.id) : catalogue.ingredients.get(ref.id);
}

/** Every ingredient in a food: itself for an ingredient; recipe items plus cooking fat for a dish. */
export function foodIngredients(ref: FoodRef, catalogue: Catalogue = CATALOGUE): { ingredient: Ingredient; optional: boolean }[] {
  if (ref.kind === 'ingredient') {
    const ing = catalogue.ingredients.get(ref.id);
    return ing ? [{ ingredient: ing, optional: false }] : [];
  }
  const dish = catalogue.dishes.get(ref.id);
  if (!dish) return [];
  return recipeIngredientIds(dish).flatMap(({ ingredientId, optional }) => {
    const ing = catalogue.ingredients.get(ingredientId);
    return ing ? [{ ingredient: ing, optional }] : [];
  });
}

export interface ComputedNutrients {
  values: Nutrients;
  /** Sum of the values that are known, for showing "at least" when something is missing. */
  known: Record<NutrientKey, number>;
  /** Ingredient IDs whose value was missing, per nutrient. A missing value makes the total null. */
  missingFrom: Record<NutrientKey, string[]>;
}

function emptyMissing(): Record<NutrientKey, string[]> {
  return { energyKcal: [], proteinG: [], fatG: [], carbG: [], fibreG: [] };
}

/**
 * Nutrients of one serving of a dish, with the given grams of cooking fat. Computed from the recipe
 * (all items, optional ones included, as written). Any missing ingredient value makes that nutrient null.
 */
export function dishPerServing(dish: DishRecipe, oilGrams: number, catalogue: Catalogue = CATALOGUE): ComputedNutrients {
  const sums: Record<NutrientKey, number> = { energyKcal: 0, proteinG: 0, fatG: 0, carbG: 0, fibreG: 0 };
  const missingFrom = emptyMissing();
  const add = (ingredientId: string, grams: number) => {
    const ing = catalogue.ingredients.get(ingredientId);
    for (const k of NUTRIENT_KEYS) {
      const per100 = ing?.per100g[k];
      if (per100 === null || per100 === undefined) missingFrom[k].push(ingredientId);
      else sums[k] += (per100 * grams) / 100;
    }
  };
  for (const r of dish.ingredients) add(r.ingredientId, r.grams / dish.yieldServings);
  if (dish.oil && oilGrams > 0) add(dish.oil.ingredientId, oilGrams);
  const values = {} as Nutrients;
  for (const k of NUTRIENT_KEYS) values[k] = missingFrom[k].length > 0 ? null : sums[k];
  return { values, known: sums, missingFrom };
}
