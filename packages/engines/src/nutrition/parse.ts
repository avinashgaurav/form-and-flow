import { CATALOGUE, getFood, type Catalogue, type FoodRef, type FoodUnit, type OilLevel } from './catalogue';
import { normalize, searchFoods } from './search';
import type { LogItem } from './totals';

/**
 * Deterministic text meal parser (plan/07 S41). No AI. "2 roti, dal, bhindi" becomes draft rows the
 * user edits and confirms. The parser never saves anything and never drops or guesses an item: words
 * it cannot match come back as unmatched rows with the user's own text.
 */

export interface DraftItem {
  /** The user's text for this item. */
  text: string;
  /** The words naming the food, used to prefill search when unmatched. */
  foodText: string;
  match?: FoodRef & { name: string };
  quantity: number;
  /** Null when the user gave no unit and the food has no household default. */
  unit: FoodUnit | null;
  confidence: 'high' | 'low';
  unmatched?: true;
}

/** Item separators: commas, semicolons, plus, ampersand, newlines, "and", "aur". */
const SEPARATORS = /\s*(?:[,;+&\n\r]|\band\b|\baur\b)\s*/i;

/** Number words, English and Hindi or Hinglish. */
export const QUANTITY_WORDS: Readonly<Record<string, number>> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6,
  half: 0.5, aadha: 0.5, adha: 0.5, aadhi: 0.5, adhi: 0.5, aadhe: 0.5, quarter: 0.25,
  dedh: 1.5, derh: 1.5, dhedh: 1.5,
  dhai: 2.5, dhaai: 2.5, adhai: 2.5, arhai: 2.5,
  sawa: 1.25, sava: 1.25,
  paune: 0.75, pauna: 0.75, paun: 0.75,
};

/** "sawa do" is 2.25 and "paune do" is 1.75; alone they are 1.25 and 0.75. */
const QUARTER_MODIFIERS: Readonly<Record<string, number>> = { sawa: 0.25, sava: 0.25, paune: -0.25, pauna: -0.25, paun: -0.25 };

/** Unit words. Weights and volumes convert to g or ml; "pav" is a quarter kilo, so 250 g. */
export const UNIT_WORDS: Readonly<Record<string, { unit: FoodUnit; factor: number }>> = (() => {
  const out: Record<string, { unit: FoodUnit; factor: number }> = {};
  const add = (unit: FoodUnit, factor: number, words: string[]) => words.forEach((w) => (out[w] = { unit, factor }));
  add('katori', 1, ['katori', 'katoris', 'katoriyan', 'katore', 'kattori', 'vati', 'wati', 'bowl', 'bowls']);
  add('plate', 1, ['plate', 'plates']);
  add('piece', 1, ['piece', 'pieces', 'pc', 'pcs', 'nos', 'slice', 'slices']);
  add('glass', 1, ['glass', 'glasses', 'gilas']);
  add('cup', 1, ['cup', 'cups']);
  add('tbsp', 1, ['tbsp', 'tbs', 'tablespoon', 'tablespoons']);
  add('tsp', 1, ['tsp', 'teaspoon', 'teaspoons']);
  add('g', 1, ['g', 'gm', 'gms', 'gram', 'grams', 'gramme', 'grammes', 'gr']);
  add('g', 1000, ['kg', 'kgs', 'kilo', 'kilos']);
  add('g', 250, ['pav', 'paav', 'pao']);
  add('ml', 1, ['ml', 'mls', 'millilitre', 'millilitres', 'milliliter', 'milliliters']);
  add('ml', 1000, ['l', 'ltr', 'litre', 'litres', 'liter', 'liters']);
  add('serving', 1, ['serving', 'servings', 'portion', 'portions']);
  return out;
})();

const PAV_WORDS = new Set(['pav', 'paav', 'pao']);
const NUMBER = /^(\d+(?:\.\d+)?|\.\d+)$/;
const FRACTION = /^(\d+)\/(\d+)$/;

function numberValue(token: string | undefined): number | null {
  if (token === undefined) return null;
  if (NUMBER.test(token)) return Number(token);
  const f = FRACTION.exec(token);
  if (f && Number(f[2]) !== 0) return Number(f[1]) / Number(f[2]);
  return null;
}

/** Read a quantity starting at tokens[i]. Handles 2, 1.5, 1/2, 1 1/2, ek, dedh, sawa do. */
function readQuantity(tokens: string[], i: number): { value: number; next: number } | null {
  const t = tokens[i];
  if (t === undefined) return null;
  const mod = QUARTER_MODIFIERS[t];
  if (mod !== undefined) {
    const after = readQuantity(tokens, i + 1);
    if (after && after.value >= 1) return { value: after.value + mod, next: after.next };
  }
  const word = QUANTITY_WORDS[t];
  if (word !== undefined) return { value: word, next: i + 1 };
  const n = numberValue(t);
  if (n === null) return null;
  const frac = FRACTION.test(tokens[i + 1] ?? '') ? numberValue(tokens[i + 1]) : null;
  return frac !== null && NUMBER.test(t) ? { value: n + frac, next: i + 2 } : { value: n, next: i + 1 };
}

function tokenize(segment: string): { tokens: string[]; range: boolean } {
  let s = segment.toLowerCase().replace(/½/g, ' 1/2 ').replace(/¼/g, ' 1/4 ').replace(/¾/g, ' 3/4 ');
  let range = false;
  s = s.replace(/(\d+(?:\.\d+)?)\s*(?:-|\u2013|to)\s*(\d+(?:\.\d+)?)/g, (_m, a: string, b: string) => {
    range = true;
    return ` ${(Number(a) + Number(b)) / 2} `;
  });
  s = s.replace(/(\d)([a-z])/g, '$1 $2').replace(/\bx\s*(\d)/g, '$1');
  const tokens = s
    .split(/\s+/)
    .map((t) => (NUMBER.test(t) || FRACTION.test(t) ? t : normalize(t)))
    .flatMap((t) => t.split(' '))
    .filter((t) => t && t !== 'x');
  return { tokens, range };
}

interface Pieces {
  quantity?: number;
  unit?: { unit: FoodUnit; factor: number; word: string };
  food: string[];
}

function splitPieces(tokens: string[]): Pieces {
  const lead = readQuantity(tokens, 0);
  let i = lead?.next ?? 0;
  const unitWord = tokens[i];
  const unit = unitWord !== undefined && UNIT_WORDS[unitWord] ? { ...UNIT_WORDS[unitWord]!, word: unitWord } : undefined;
  if (unit) i++;
  if (tokens[i] === 'of') i++;
  let food = tokens.slice(i);
  if (lead || unit) return { quantity: lead?.value, unit, food };

  // Quantity after the food: "roti 2", "paneer 100 g", "chai 200 ml".
  const last = food.at(-1);
  const lastUnit = last !== undefined ? UNIT_WORDS[last] : undefined;
  if (lastUnit && food.length >= 2) {
    const q = numberValue(food.at(-2));
    if (q !== null) return { quantity: q, unit: { ...lastUnit, word: last! }, food: food.slice(0, -2) };
  }
  const q = numberValue(last);
  if (q !== null && food.length >= 2) food = food.slice(0, -1);
  return { quantity: q ?? undefined, food };
}

function unitKnown(ref: FoodRef, unit: FoodUnit, catalogue: Catalogue): boolean {
  if (unit === 'g') return true;
  if (unit === 'serving') return ref.kind === 'dish';
  return getFood(ref, catalogue)?.units.some((u) => u.unit === unit) ?? false;
}

function parseSegment(text: string, catalogue: Catalogue): DraftItem {
  const { tokens, range } = tokenize(text);
  let p = splitPieces(tokens);
  let hit = searchFoods(p.food.join(' '), { limit: 1, catalogue })[0];
  // "pav" is also bread ("pav bhaji"): treat it as 250 g only when the rest names a known food.
  if (!hit && p.unit && PAV_WORDS.has(p.unit.word)) {
    p = { quantity: p.quantity, food: [p.unit.word, ...p.food] };
    hit = searchFoods(p.food.join(' '), { limit: 1, catalogue })[0];
  }
  const foodText = p.food.join(' ');
  const raw = (p.quantity ?? 1) * (p.unit?.factor ?? 1);
  const measured = p.unit?.unit === 'g' || p.unit?.unit === 'ml';
  // Bounds as on the portion screen (S22): household units 0.25 to 20, grams or millilitres 1 to 5,000.
  const quantity = Number.isFinite(raw) ? Math.min(measured ? 5000 : 20, Math.max(measured ? 1 : 0.25, raw)) : 1;
  const clamped = quantity !== raw;
  if (!hit) return { text, foodText, quantity, unit: p.unit?.unit ?? null, confidence: 'low', unmatched: true };

  const ref: FoodRef = { kind: hit.kind, id: hit.id };
  const food = getFood(ref, catalogue)!;
  // Grams are only a default when the user said so; a bare "paneer" needs the user to give an amount.
  const unit = p.unit?.unit ?? (food.defaultUnit === 'g' ? null : food.defaultUnit);
  const high = !clamped && hit.exact && hit.tier !== 'fuzzy' && !range && unit !== null && unitKnown(ref, unit, catalogue);
  return { text, foodText, match: { ...ref, name: hit.name }, quantity, unit, confidence: high ? 'high' : 'low' };
}

/** Split a meal description into draft items. Pure: nothing is saved. */
export function parseMealText(input: string, catalogue: Catalogue = CATALOGUE): DraftItem[] {
  return input
    .split(SEPARATORS)
    .map((s) => s.trim())
    .filter((s) => normalize(s).length > 0)
    .map((s) => parseSegment(s, catalogue));
}

/** Turn a confirmed draft into a loggable item, or null if it still needs a food or a unit. */
export function draftToLogItem(draft: DraftItem, oilLevel?: OilLevel): LogItem | null {
  if (!draft.match || draft.unit === null || !Number.isFinite(draft.quantity) || draft.quantity <= 0) return null;
  const item: LogItem = { food: { kind: draft.match.kind, id: draft.match.id }, quantity: draft.quantity, unit: draft.unit };
  return oilLevel ? { ...item, oilLevel } : item;
}
