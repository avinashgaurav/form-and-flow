import type { Equipment } from '@ff/engines';

/** Short, plain names for equipment, as they read in a sentence. */
export const EQUIPMENT_NAME: Record<Equipment, string> = {
  dumbbells: 'dumbbells',
  kettlebell: 'kettlebell',
  bands: 'resistance band',
  bench: 'bench',
  barbell: 'barbell',
  rack: 'squat rack',
  cable: 'cable machine',
  machines: 'weight machine',
  pullup_bar: 'pull-up bar',
};

/**
 * What an exercise needs, for the library: everything in `allOf`, plus one of `anyOf`. Required
 * items are joined with "+", alternatives with "or": "bench + dumbbells or barbell".
 */
export function equipmentText(anyOf: readonly Equipment[], allOf: readonly Equipment[]): string {
  const parts = allOf.map((e) => EQUIPMENT_NAME[e]);
  if (anyOf.length) parts.push(anyOf.map((e) => EQUIPMENT_NAME[e]).join(' or '));
  return parts.join(' + ') || 'no equipment';
}

/** A list of equipment someone has, in plain words. */
export function equipmentList(items: readonly Equipment[]): string {
  return items.map((e) => EQUIPMENT_NAME[e]).join(', ') || 'none';
}
