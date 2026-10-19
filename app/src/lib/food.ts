import {
  computeTargets,
  getFood,
  roundEstimate,
  snapshot,
  sumTotals,
  type FoodPrefs,
  type FoodRef,
  type FoodUnit,
  type LogItem,
  type NutrientKey,
  type NutrientTotal,
  type NutrientTotals,
  type NutritionTargets,
} from '@ff/engines';
import type { AppState, MealItem, MealLog, MealType } from '../store/types';

/** App-side glue for the nutrition engine (plan/10). The engine decides every number. */

/** Where the numbers come from, said plainly wherever totals are shown. */
export const FOOD_DATA_NOTE =
  'Ingredient values are from USDA FoodData Central (SR Legacy); paneer and poha are still our estimates. Dish recipes and portion sizes are our estimates and are being reviewed. Treat totals as ranges.';

export const MEAL_LABEL: Record<MealType, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export function mealTypeAt(d: Date): MealType {
  const h = d.getHours();
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 16) return 'lunch';
  if (h >= 16 && h < 19) return 'snack';
  return 'dinner';
}

/** Plate guidance hides every calorie number. A non_numeric_only limit forces it, whatever the setting. */
export function numericMode(state: AppState): boolean {
  return state.nutrition.mode === 'numeric' && !state.restrictions.some((r) => r.code === 'non_numeric_only');
}

export function foodPrefs(state: AppState): FoodPrefs {
  const n = state.nutrition;
  return { diet: n.diet, jain: n.jain, allergens: n.allergens, freeTextAllergies: n.freeTextAllergies };
}

export function targetsFor(state: AppState, now = new Date()): NutritionTargets {
  const p = state.profile;
  return computeTargets({
    sex: state.nutrition.sex ?? 'prefer_not_to_say',
    ageYears: p ? now.getFullYear() - p.birthYear : null,
    heightCm: p?.heightCm ?? null,
    weightKg: p?.weightKg ?? null,
    activity: p?.activity ?? 'light',
    goal: p?.goal ?? 'fitness',
    restrictions: state.restrictions,
    experience: p?.training.experience,
    preferNonNumeric: state.nutrition.mode === 'non_numeric',
    resistanceTraining: true,
  });
}

export function mealsOn(state: AppState, day: string): MealLog[] {
  return state.meals.filter((m) => m.day === day).sort((a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType) || a.at.localeCompare(b.at));
}

export function totalsOf(items: MealItem[]): NutrientTotals | null {
  return items.length ? sumTotals(items.map((i) => i.snapshot)) : null;
}

const UNIT: Record<NutrientKey, string> = { energyKcal: 'kcal', proteinG: 'g protein', fatG: 'g fat', carbG: 'g carbs', fibreG: 'g fibre' };

/** "350 to 420 kcal", or "at least 300 kcal" when a value is missing (never shown as zero). */
export function fmtTotal(key: NutrientKey, t: NutrientTotal | undefined): string {
  if (!t) return 'not available';
  const e = roundEstimate(key, t.status === 'complete' ? t : t.knownPart);
  const n = (v: number) => v.toLocaleString('en-IN');
  if (t.status === 'incomplete') return e.low > 0 ? `at least ${n(e.low)} ${UNIT[key]} (some values not available)` : 'not available';
  return e.low === e.high ? `${n(e.mid)} ${UNIT[key]}` : `${n(e.low)} to ${n(e.high)} ${UNIT[key]}`;
}

export const UNIT_LABEL: Record<FoodUnit, [string, string]> = {
  katori: ['katori', 'katoris'],
  plate: ['plate', 'plates'],
  piece: ['piece', 'pieces'],
  glass: ['glass', 'glasses'],
  cup: ['cup', 'cups'],
  tbsp: ['tbsp', 'tbsp'],
  tsp: ['tsp', 'tsp'],
  g: ['g', 'g'],
  ml: ['ml', 'ml'],
  serving: ['serving', 'servings'],
};

export function fmtPortion(quantity: number, unit: FoodUnit): string {
  const q = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${q} ${UNIT_LABEL[unit][quantity === 1 ? 0 : 1]}`;
}

/** Units the user can pick for a food: its household units, then grams (which always work). */
export function unitsFor(ref: FoodRef): FoodUnit[] {
  const f = getFood(ref);
  if (!f) return ['g'];
  return [...new Set<FoodUnit>([...f.units.map((u) => u.unit), 'g'])];
}

export function hasOilChoice(ref: FoodRef): boolean {
  if (ref.kind !== 'dish') return false;
  const f = getFood(ref) as { oil?: unknown } | undefined;
  return !!f?.oil;
}

/** Freeze one item for the log. Returns null when the engine cannot size the portion. */
export function toMealItem(id: string, name: string, item: LogItem): MealItem | null {
  const snap = snapshot(item);
  if (!snap.grams || snap.grams.mid <= 0) return null;
  return { id, food: item.food, name, quantity: item.quantity, unit: item.unit, oilLevel: item.oilLevel, snapshot: snap };
}

/** Facts the coach may quote, only in numeric mode (number provenance, plan/13). */
export function nutritionFacts(state: AppState): Record<string, number | string> {
  if (!numericMode(state)) return {};
  const t = targetsFor(state);
  if (t.mode !== 'numeric') return {};
  const f: Record<string, number | string> = {};
  if (t.energy) Object.assign(f, { energy_kcal_low: t.energy.displayKcal.low, energy_kcal_high: t.energy.displayKcal.high });
  if (t.protein) {
    f.protein_kind = t.protein.kind;
    f.protein_g_low = t.protein.grams.low;
    f.protein_g_default = t.protein.grams.default;
    if (t.protein.grams.high !== null) f.protein_g_high = t.protein.grams.high;
  }
  return f;
}

export interface FoodDay {
  day: string;
  meals: number;
  /** Middle of the logged energy range; null when nothing was logged. Some values may be missing. */
  energyKcal: number | null;
  proteinG: number | null;
  /** True when any item lacked a value, so the day is a floor, not a total. */
  partial: boolean;
}

/** Logged food per day for the given days. Shows what was logged, not what was eaten. */
export function foodDays(state: AppState, days: string[]): FoodDay[] {
  return days.map((day) => {
    const meals = mealsOn(state, day);
    const t = totalsOf(meals.flatMap((m) => m.items));
    if (!t) return { day, meals: 0, energyKcal: null, proteinG: null, partial: false };
    const mid = (x: NutrientTotal) => (x.status === 'complete' ? x.mid : x.knownPart.mid);
    return {
      day,
      meals: meals.length,
      energyKcal: Math.round(mid(t.energyKcal) / 10) * 10,
      proteinG: Math.round(mid(t.proteinG)),
      partial: t.energyKcal.status === 'incomplete' || t.proteinG.status === 'incomplete',
    };
  });
}
