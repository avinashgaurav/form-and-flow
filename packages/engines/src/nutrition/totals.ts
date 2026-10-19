import {
  CATALOGUE,
  dishPerServing,
  getFood,
  NUTRIENT_KEYS,
  type Catalogue,
  type Dish,
  type FoodRef,
  type FoodUnit,
  type Ingredient,
  type NutrientKey,
  type NutritionSource,
  type OilLevel,
} from './catalogue';

/**
 * Nutrient totals with an honest range (plan/07 G-NUM, S22). Portion uncertainty is plus or minus
 * 5 per cent for weighed or measured amounts and 15 per cent for household units. Cooking fat adds
 * its own range: light to rich when the user did not say, or the chosen level plus or minus 20 per
 * cent when they did. A missing nutrient makes the total "incomplete", never zero. Values are not
 * rounded here; round only for display.
 */

export const PORTION_UNCERTAINTY = { measured: 0.05, household: 0.15 } as const;
export const CHOSEN_OIL_UNCERTAINTY = 0.2;

export interface LogItem {
  food: FoodRef;
  quantity: number;
  unit: FoodUnit;
  /** What the user said about the cooking fat; absent means they did not say. */
  oilLevel?: OilLevel;
}

export interface Estimate {
  mid: number;
  low: number;
  high: number;
}

export type NutrientTotal =
  | ({ status: 'complete' } & Estimate)
  /** Some value was missing. knownPart covers only the known values; it is a floor, not the total. */
  | { status: 'incomplete'; missingFrom: string[]; knownPart: Estimate };

export type NutrientTotals = Record<NutrientKey, NutrientTotal>;

export interface ItemTotals {
  food: FoodRef;
  /** measured: g or ml. household: katori, piece and so on. unknown_unit: this food has no such unit. */
  basis: 'measured' | 'household' | 'unknown_unit' | 'unknown_food';
  confidence: 'high' | 'low';
  grams: Estimate | null;
  oilGrams: Estimate | null;
  nutrients: NutrientTotals;
}

const ZERO: Estimate = { mid: 0, low: 0, high: 0 };

/** Grams in one unit of a food, or null when this food has no such unit. */
export function gramsPerUnit(food: Ingredient | Dish, kind: FoodRef['kind'], unit: FoodUnit): number | null {
  if (unit === 'g') return 1;
  if (unit === 'serving' && kind === 'dish') return (food as Dish).servingGrams;
  return food.units.find((u) => u.unit === unit)?.grams ?? null;
}

function allIncomplete(id: string): NutrientTotals {
  const out = {} as NutrientTotals;
  for (const k of NUTRIENT_KEYS) out[k] = { status: 'incomplete', missingFrom: [id], knownPart: { ...ZERO } };
  return out;
}

function oilRange(dish: Dish, chosen: OilLevel | undefined): Estimate {
  if (!dish.oil) return { ...ZERO };
  const l = dish.oil.levels;
  if (!chosen) return { mid: l.normal, low: l.light, high: l.rich };
  const g = l[chosen];
  return { mid: g, low: g * (1 - CHOSEN_OIL_UNCERTAINTY), high: g * (1 + CHOSEN_OIL_UNCERTAINTY) };
}

/** Totals for one logged item. Throws if quantity is not a positive number. */
export function itemTotals(item: LogItem, catalogue: Catalogue = CATALOGUE): ItemTotals {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new RangeError('quantity must be a positive number');
  const food = { kind: item.food.kind, id: item.food.id };
  const found = getFood(food, catalogue);
  if (!found) return { food, basis: 'unknown_food', confidence: 'low', grams: null, oilGrams: null, nutrients: allIncomplete(food.id) };
  const perUnit = gramsPerUnit(found, food.kind, item.unit);
  if (perUnit === null) return { food, basis: 'unknown_unit', confidence: 'low', grams: null, oilGrams: null, nutrients: allIncomplete(food.id) };

  const measured = item.unit === 'g' || item.unit === 'ml';
  const p = measured ? PORTION_UNCERTAINTY.measured : PORTION_UNCERTAINTY.household;
  const g = item.quantity * perUnit;
  const grams: Estimate = { mid: g, low: g * (1 - p), high: g * (1 + p) };
  const nutrients = {} as NutrientTotals;
  let oilGrams: Estimate | null = null;

  if (food.kind === 'ingredient') {
    const ing = found as Ingredient;
    for (const k of NUTRIENT_KEYS) {
      const v = ing.per100g[k];
      nutrients[k] =
        v === null
          ? { status: 'incomplete', missingFrom: [ing.id], knownPart: { ...ZERO } }
          : { status: 'complete', mid: (v * g) / 100, low: (v * grams.low) / 100, high: (v * grams.high) / 100 };
    }
  } else {
    const dish = found as Dish;
    const servings = g / dish.servingGrams;
    const oil = oilRange(dish, item.oilLevel);
    const mid = dishPerServing(dish, oil.mid, catalogue);
    const low = dishPerServing(dish, oil.low, catalogue);
    const high = dishPerServing(dish, oil.high, catalogue);
    const lowServings = servings * (1 - p);
    const highServings = servings * (1 + p);
    for (const k of NUTRIENT_KEYS) {
      const m = mid.values[k];
      const lo = low.values[k];
      const hi = high.values[k];
      nutrients[k] =
        m === null || lo === null || hi === null
          ? {
              status: 'incomplete',
              missingFrom: [...mid.missingFrom[k]],
              knownPart: { mid: servings * mid.known[k], low: lowServings * low.known[k], high: highServings * high.known[k] },
            }
          : { status: 'complete', mid: servings * m, low: lowServings * lo, high: highServings * hi };
    }
    if (dish.oil) oilGrams = { mid: servings * oil.mid, low: lowServings * oil.low, high: highServings * oil.high };
  }
  return { food, basis: measured ? 'measured' : 'household', confidence: 'high', grams, oilGrams, nutrients };
}

/** Add up items or stored snapshots. Anything incomplete makes that nutrient's total incomplete. */
export function sumTotals(items: readonly { nutrients: NutrientTotals }[]): NutrientTotals {
  const out = {} as NutrientTotals;
  for (const k of NUTRIENT_KEYS) {
    const sum: Estimate = { ...ZERO };
    const missing = new Set<string>();
    for (const it of items) {
      const n = it.nutrients[k];
      const e = n.status === 'complete' ? n : n.knownPart;
      if (n.status === 'incomplete') n.missingFrom.forEach((m) => missing.add(m));
      sum.mid += e.mid;
      sum.low += e.low;
      sum.high += e.high;
    }
    out[k] = missing.size === 0 ? { status: 'complete', ...sum } : { status: 'incomplete', missingFrom: [...missing].sort(), knownPart: sum };
  }
  return out;
}

/** What a meal log row stores (plan/12 meal_log_items.nutrients_snapshot). Plain data, frozen. */
export interface LogSnapshot {
  food: FoodRef;
  foodName: string | null;
  quantity: number;
  unit: FoodUnit;
  oilLevel: OilLevel | null;
  basis: ItemTotals['basis'];
  confidence: ItemTotals['confidence'];
  grams: Estimate | null;
  oilGrams: Estimate | null;
  nutrients: NutrientTotals;
  sourceStatus: NutritionSource['status'] | null;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/**
 * Compute the item now and copy the result, so later edits to a dish or ingredient never change a
 * historical total. Store this with the log; read history from the snapshot, not the catalogue.
 */
export function snapshot(item: LogItem, catalogue: Catalogue = CATALOGUE): LogSnapshot {
  const t = itemTotals(item, catalogue);
  const found = getFood(item.food, catalogue);
  const snap: LogSnapshot = {
    food: t.food,
    foodName: found?.name ?? null,
    quantity: item.quantity,
    unit: item.unit,
    oilLevel: item.oilLevel ?? null,
    basis: t.basis,
    confidence: t.confidence,
    grams: t.grams,
    oilGrams: t.oilGrams,
    nutrients: t.nutrients,
    sourceStatus: found?.source.status ?? null,
  };
  return deepFreeze(JSON.parse(JSON.stringify(snap)) as LogSnapshot);
}

/** Display rounding only: energy to the nearest 5 kcal; grams to 0.1 below 10 g, else whole grams. */
export function roundForDisplay(key: NutrientKey, value: number): number {
  if (key === 'energyKcal') return Math.round(value / 5) * 5;
  return value < 10 ? Math.round(value * 10) / 10 : Math.round(value);
}

export function roundEstimate(key: NutrientKey, e: Estimate): Estimate {
  return { mid: roundForDisplay(key, e.mid), low: roundForDisplay(key, e.low), high: roundForDisplay(key, e.high) };
}
