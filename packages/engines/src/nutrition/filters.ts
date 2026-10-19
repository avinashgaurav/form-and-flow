import { CATALOGUE, foodIngredients, getFood, type AllergenTag, type Catalogue, type DietTag, type FoodRef } from './catalogue';
import { headword, normalize, singularize } from './search';

/**
 * Allergen and diet filters (plan/13 FD-02, plan/07 S21). Suggestions exclude a food if any of its
 * ingredients, optional ones included, carries a declared allergen or a free-text allergy. Logging
 * is never blocked: the user can record what they actually ate, and gets a warning flag.
 */

export type Diet = 'vegan' | 'veg' | 'egg' | 'non_veg';

export interface FoodPrefs {
  diet?: Diet;
  jain?: boolean;
  allergens?: AllergenTag[];
  /** Allergies typed by the user, such as "kaju" or "dairy". */
  freeTextAllergies?: string[];
}

export type ExclusionReason =
  | { code: 'allergen'; tag: AllergenTag; ingredientId: string; optional: boolean }
  | { code: 'free_text'; text: string; ingredientId: string; optional: boolean }
  | { code: 'diet'; diet: Diet }
  | { code: 'jain' }
  | { code: 'unknown_food' };

/** Plain words that name an allergen group. Over-matching is the safe direction for allergies. */
export const ALLERGEN_WORDS: Readonly<Record<AllergenTag, string[]>> = {
  milk: ['milk', 'dairy', 'lactose', 'doodh', 'casein', 'whey'],
  gluten: ['gluten', 'wheat', 'gehun', 'celiac', 'coeliac'],
  peanut: ['peanut', 'groundnut', 'moongphali', 'mungfali', 'nut'],
  tree_nut: ['tree nut', 'nut', 'cashew', 'kaju', 'almond', 'badam', 'walnut', 'akhrot', 'pista', 'pistachio'],
  soy: ['soy', 'soya', 'soybean'],
  egg: ['egg', 'anda'],
  fish: ['fish', 'machli', 'machhli'],
  shellfish: ['shellfish', 'prawn', 'shrimp', 'jhinga', 'crab', 'lobster'],
  sesame: ['sesame', 'til', 'gingelly'],
  mustard: ['mustard', 'sarson', 'rai'],
};

const fold = (s: string) => normalize(s).split(' ').map(singularize).join(' ');
const hasPhrase = (haystack: string, phrase: string) => phrase.length > 0 && ` ${haystack} `.includes(` ${phrase} `);

export interface FreeTextMatch {
  ingredientIds: string[];
  tags: AllergenTag[];
  /** Entries we could not match; the UI should ask the user to check labels. */
  unrecognised: string[];
}

/** Match free-text allergies against ingredient names and aliases, and allergen group words. */
export function matchFreeTextAllergies(texts: string[], catalogue: Catalogue = CATALOGUE): FreeTextMatch {
  const ingredientIds = new Set<string>();
  const tags = new Set<AllergenTag>();
  const unrecognised: string[] = [];
  for (const raw of texts) {
    const t = fold(raw);
    if (!t) continue;
    let hit = false;
    for (const ing of catalogue.ingredients.values()) {
      const names = [ing.name, ...ing.aliases].map(fold).concat(fold(headword(ing.name)));
      if (names.some((n) => hasPhrase(n, t))) {
        ingredientIds.add(ing.id);
        hit = true;
      }
    }
    for (const [tag, words] of Object.entries(ALLERGEN_WORDS) as [AllergenTag, string[]][]) {
      if (words.some((w) => hasPhrase(t, fold(w)))) {
        tags.add(tag);
        hit = true;
      }
    }
    if (!hit) unrecognised.push(raw);
  }
  return { ingredientIds: [...ingredientIds].sort(), tags: [...tags].sort(), unrecognised };
}

function allergyReasons(food: FoodRef, prefs: FoodPrefs, catalogue: Catalogue): ExclusionReason[] {
  const declared = new Set(prefs.allergens ?? []);
  const free = (prefs.freeTextAllergies ?? []).map((text) => ({ text, m: matchFreeTextAllergies([text], catalogue) }));
  const reasons: ExclusionReason[] = [];
  for (const { ingredient, optional } of foodIngredients(food, catalogue)) {
    for (const tag of ingredient.allergenTags) if (declared.has(tag)) reasons.push({ code: 'allergen', tag, ingredientId: ingredient.id, optional });
    for (const { text, m } of free) {
      if (m.ingredientIds.includes(ingredient.id) || ingredient.allergenTags.some((t) => m.tags.includes(t)))
        reasons.push({ code: 'free_text', text, ingredientId: ingredient.id, optional });
    }
  }
  return reasons;
}

/** Why a food is excluded from suggestions. Empty means it can be suggested. */
export function exclusionReasons(food: FoodRef, prefs: FoodPrefs, catalogue: Catalogue = CATALOGUE): ExclusionReason[] {
  const found = getFood(food, catalogue);
  if (!found) return [{ code: 'unknown_food' }];
  const reasons = allergyReasons(food, prefs, catalogue);
  const tags: DietTag[] = food.kind === 'dish' ? catalogue.dishes.get(food.id)!.dietTags : catalogue.ingredients.get(food.id)!.dietTags;
  if (prefs.diet && !tags.includes(prefs.diet)) reasons.push({ code: 'diet', diet: prefs.diet });
  if (prefs.jain && !tags.includes('jain_ok')) reasons.push({ code: 'jain' });
  return reasons;
}

export function isSuggestible(food: FoodRef, prefs: FoodPrefs, catalogue: Catalogue = CATALOGUE): boolean {
  return exclusionReasons(food, prefs, catalogue).length === 0;
}

/** Hard exclusion for suggestions (FD-02). Keeps the input order. */
export function filterSuggestions<T extends FoodRef>(foods: T[], prefs: FoodPrefs, catalogue: Catalogue = CATALOGUE): T[] {
  return foods.filter((f) => isSuggestible(f, prefs, catalogue));
}

export interface LogCheck {
  /** Logging is always allowed: people record what they actually ate. */
  allowed: true;
  warning: boolean;
  reasons: ExclusionReason[];
}

/** Check a food the user is logging. Allergens give a warning, never a block. Diet choices do not warn. */
export function checkLogFood(food: FoodRef, prefs: FoodPrefs, catalogue: Catalogue = CATALOGUE): LogCheck {
  const reasons = allergyReasons(food, prefs, catalogue);
  return { allowed: true, warning: reasons.length > 0, reasons };
}
