/**
 * Stored values are always canonical (kg, cm). Conversion happens only for display and input.
 */

export const LB_PER_KG = 2.20462262185;
export const CM_PER_IN = 2.54;

export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const lbToKg = (lb: number): number => lb / LB_PER_KG;
export const cmToIn = (cm: number): number => cm / CM_PER_IN;
export const inToCm = (inch: number): number => inch * CM_PER_IN;

/** Round to the nearest step, e.g. 0.5 kg plates or 2.5 kg jumps. */
export function roundToStep(value: number, step: number): number {
  if (step <= 0) throw new Error('step must be positive');
  return Math.round(value / step) * step;
}

export type UnitSystem = 'metric' | 'imperial';

/** Display a canonical kg value in the user's units. One decimal place, no rounding of the stored value. */
export function displayWeight(kg: number, units: UnitSystem): { value: number; unit: 'kg' | 'lb' } {
  return units === 'metric'
    ? { value: Math.round(kg * 10) / 10, unit: 'kg' }
    : { value: Math.round(kgToLb(kg) * 10) / 10, unit: 'lb' };
}

/** Parse a user-entered weight back to canonical kg. */
export function inputWeightToKg(value: number, units: UnitSystem): number {
  return units === 'metric' ? value : lbToKg(value);
}

/** Plausibility ranges from plan/08 (step 5). Out-of-range values are rejected; odd ones are confirmed. */
export const RANGES = {
  heightCm: { min: 120, max: 220 },
  weightKg: { min: 30, max: 250 },
  sessionMinutes: { min: 10, max: 120 },
  reps: { min: 0, max: 100 },
  loadKg: { min: 0, max: 500 },
} as const;

export function inRange(value: number, range: { min: number; max: number }): boolean {
  return Number.isFinite(value) && value >= range.min && value <= range.max;
}

/** BMI outside 15 to 60 is not rejected, only confirmed with the user (plan/08). */
export function needsPlausibilityCheck(heightCm: number, weightKg: number): boolean {
  const m = heightCm / 100;
  const bmi = weightKg / (m * m);
  return bmi < 15 || bmi > 60;
}
