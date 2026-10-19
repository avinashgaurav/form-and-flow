import { CATALOGUE, getFood, type Catalogue, type FoodUnit } from './catalogue';
import type { DraftItem } from './parse';
import { PHOTO_MAX_ITEMS, PHOTO_UNITS, type PhotoItem } from './photo-prompt';
import { searchFoods } from './search';

/**
 * Turn what the model saw into editable drafts, exactly like typed text: names are matched against
 * the catalogue by the same search, amounts are bounded, and every draft is marked "check this"
 * (photo amounts are estimates). Nothing here produces a nutrient number.
 */
export function photoItemsToDrafts(raw: unknown, catalogue: Catalogue = CATALOGUE): DraftItem[] {
  const items = Array.isArray(raw) ? raw.slice(0, PHOTO_MAX_ITEMS) : [];
  const out: DraftItem[] = [];
  for (const it of items as Partial<PhotoItem>[]) {
    if (!it || typeof it.name !== 'string' || !it.name.trim()) continue;
    const name = it.name.trim().slice(0, 60);
    const unit = (PHOTO_UNITS as readonly string[]).includes(String(it.unit)) ? (it.unit as FoodUnit) : null;
    const measured = unit === 'g' || unit === 'ml';
    const q = Number(it.quantity);
    const quantity = Number.isFinite(q) ? Math.min(measured ? 5000 : 20, Math.max(measured ? 5 : 0.25, q)) : 1;
    const hit = searchFoods(name, { limit: 1, catalogue })[0];
    if (!hit) {
      out.push({ text: name, foodText: name, quantity, unit, confidence: 'low', unmatched: true });
      continue;
    }
    const food = getFood({ kind: hit.kind, id: hit.id }, catalogue)!;
    const known = unit !== null && (unit === 'g' || food.units.some((u) => u.unit === unit));
    out.push({
      text: name,
      foodText: name,
      match: { kind: hit.kind, id: hit.id, name: hit.name },
      // An amount in a unit this food does not have falls back to one of its usual portion.
      quantity: known ? quantity : 1,
      unit: known ? unit : food.defaultUnit === 'g' ? null : food.defaultUnit,
      confidence: 'low',
    });
  }
  return out;
}
