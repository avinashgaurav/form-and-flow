/**
 * Nutrition engine public API. Pure functions, no I/O.
 * Ingredient values come from USDA SR Legacy except paneer and poha (still estimates); dish recipes
 * and household portion sizes are unreviewed estimates. See seed-ingredients.ts.
 */

export {
  buildCatalogue,
  CATALOGUE,
  defineDish,
  dishPerServing,
  foodIngredients,
  getDish,
  getFood,
  getIngredient,
  NUTRIENT_KEYS,
  type AllergenTag,
  type Catalogue,
  type ComputedNutrients,
  type DietTag,
  type Dish,
  type DishRecipe,
  type FoodRef,
  type FoodUnit,
  type Ingredient,
  type NutrientKey,
  type Nutrients,
  type NutritionSource,
  type OilLevel,
  type RecipeItem,
  type ServingUnit,
} from './catalogue';
export { SEED_INGREDIENTS, SEED_SOURCE } from './seed-ingredients';
export { SEED_DISHES } from './seed-dishes';
export { editDistance, headword, normalize, searchFoods, singularize, type MatchTier, type SearchOptions, type SearchResult } from './search';
export { draftToLogItem, parseMealText, QUANTITY_WORDS, UNIT_WORDS, type DraftItem } from './parse';
export {
  CHOSEN_OIL_UNCERTAINTY,
  gramsPerUnit,
  itemTotals,
  PORTION_UNCERTAINTY,
  roundEstimate,
  roundForDisplay,
  snapshot,
  sumTotals,
  type Estimate,
  type ItemTotals,
  type LogItem,
  type LogSnapshot,
  type NutrientTotal,
  type NutrientTotals,
} from './totals';
export {
  ACTIVITY_FACTORS,
  computeTargets,
  DAYS_PER_MONTH,
  FAT_LOSS,
  fatLossRate,
  FIBRE_GUIDANCE,
  KCAL_PER_KG,
  MUSCLE_GAIN,
  NUTRITION_NEEDS_REVIEW,
  plateGuidance,
  PROTEIN_G_PER_KG,
  restingEnergy,
  roundKcalRange,
  type ActivityLevel,
  type EnergyTarget,
  type FibreGuidance,
  type KcalRange,
  type NumericTargets,
  type NutritionTargets,
  type PlateTargets,
  type ProteinTarget,
  type Sex,
  type TargetInput,
} from './targets';
export {
  ADAPTIVE_MIN,
  adaptiveUpdate,
  TREND_ALPHA,
  trendWeights,
  UPDATE_EVERY_DAYS,
  WEEKLY_CHANGE_CAP,
  type AdaptiveInput,
  type AdaptiveResult,
  type DayIntake,
  type WeighIn,
} from './adaptive';
export {
  ALLERGEN_WORDS,
  checkLogFood,
  exclusionReasons,
  filterSuggestions,
  isSuggestible,
  matchFreeTextAllergies,
  type Diet,
  type ExclusionReason,
  type FoodPrefs,
  type FreeTextMatch,
  type LogCheck,
} from './filters';
