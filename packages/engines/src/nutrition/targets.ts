import { codes } from '../restrictions';
import type { Experience, Goal, Restriction } from '../types';
import { inRange, RANGES } from '../units';

/**
 * Daily energy and protein targets (plan/13 rule sets EN, PR, FB, FD). Draft parameters pending the
 * dietitian's review (G-14). Every output carries the rule IDs it used. Energy is always a range,
 * never a single number, and nothing is guessed: missing inputs give null with a reason.
 */

export type Sex = 'male' | 'female' | 'prefer_not_to_say';
export type ActivityLevel = 'low' | 'light' | 'moderate' | 'high';

/** Activity multipliers. An assumption about the user, so the output labels it as one. */
export const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = { low: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };

/** Energy in 1 kg of body-weight change. A flagged approximation, not a measured value. */
export const KCAL_PER_KG = 7700;
export const DAYS_PER_MONTH = 365.25 / 12;

/** EN-02: default fat-loss pace and the hard caps. */
export const FAT_LOSS = { defaultKgPerWeek: 0.5, maxKgPerWeek: 1, maxFractionOfWeightPerWeek: 0.01 } as const;
/** EN-05: target gain per month as a fraction of body weight; beginners up to 1.5 per cent. */
export const MUSCLE_GAIN = { lowFractionPerMonth: 0.005, highFractionPerMonth: 0.01, beginnerHighFractionPerMonth: 0.015 } as const;
/** PR-01 floor and PR-02 range, grams per kg of body weight a day. */
export const PROTEIN_G_PER_KG = { floor: 0.83, low: 1.4, default: 1.6, high: 2.0 } as const;

/** Rules this module uses that still need the reviewer's sign-off (plan/13 [OPEN] items). */
export const NUTRITION_NEEDS_REVIEW = [
  'EN-03 energy floor',
  'EN-05 muscle-gain surplus',
  'PR-03 higher protein option (not implemented, opt-in pending review)',
  'PR-05 reference weight for higher body weight',
] as const;

const SEX_CONSTANT: Record<Sex, number> = { male: 5, female: -161, prefer_not_to_say: (5 - 161) / 2 };
const TRAINING_GOALS: Goal[] = ['muscle_gain', 'strength'];

export interface TargetInput {
  sex: Sex;
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activity: ActivityLevel;
  goal: Goal;
  restrictions: Restriction[];
  experience?: Experience;
  /** The user chose plate guidance instead of numbers (FD-01). */
  preferNonNumeric?: boolean;
  /** Fat-loss pace the user asked for, kg a week. Defaults to 0.5 and is always capped (EN-02). */
  lossKgPerWeek?: number;
  /** The user follows a resistance-training plan, so PR-02 applies whatever the goal. */
  resistanceTraining?: boolean;
}

export interface KcalRange {
  low: number;
  high: number;
}

export interface EnergyTarget {
  kcal: KcalRange;
  /** `kcal` rounded inward to whole tens for showing and for the coach. Never outside `kcal`. */
  displayKcal: KcalRange;
  /** EN-01 Mifflin-St Jeor resting energy. Also the EN-03 floor. */
  restingKcal: number;
  activityFactor: number;
  maintenanceKcal: KcalRange;
  change: { kind: 'deficit' | 'surplus' | 'none'; kcalPerDay: KcalRange };
  floorApplied: boolean;
  ruleIds: string[];
  assumptions: string[];
}

export interface ProteinTarget {
  /** floor: at least `default`. range: low to high. cap: no target above `high`. */
  kind: 'floor' | 'range' | 'cap';
  gPerKg: { low: number; default: number; high: number | null };
  grams: { low: number; default: number; high: number | null };
  ruleIds: string[];
  note: string;
}

export interface FibreGuidance {
  target: null;
  note: string;
  ruleIds: string[];
}

export interface NumericTargets {
  mode: 'numeric';
  energy: EnergyTarget | null;
  energyReason?: string;
  protein: ProteinTarget | null;
  proteinReason?: string;
  fibre: FibreGuidance;
  reasons: { ruleId: string; text: string }[];
  ruleIds: string[];
  needsReview: string[];
}

export interface PlateTargets {
  mode: 'non_numeric';
  plate: { share: 'half' | 'quarter'; part: string; examples: string[] }[];
  proteinPerMeal: string;
  reasons: { ruleId: string; text: string }[];
  ruleIds: string[];
  needsReview: string[];
}

export type NutritionTargets = NumericTargets | PlateTargets;

export const FIBRE_GUIDANCE: FibreGuidance = {
  target: null,
  note: 'Fibre is shown as information only. There is no fibre target until the ICMR-NIN values are obtained.',
  ruleIds: ['FB-01'],
};

/**
 * Display rounding for an energy range: inward to whole tens, so the shown range never leaves the
 * computed one (the low end never drops under the EN-03 floor). Very narrow ranges round to nearest.
 */
export function roundKcalRange(r: KcalRange): KcalRange {
  const low = Math.ceil(r.low / 10) * 10;
  const high = Math.floor(r.high / 10) * 10;
  return low <= high ? { low, high } : { low: Math.round(r.low / 10) * 10, high: Math.round(r.high / 10) * 10 };
}

/** EN-01: Mifflin-St Jeor. "Prefer not to say" uses the average of the two sex constants. */
export function restingEnergy(sex: Sex, weightKg: number, heightCm: number, ageYears: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + SEX_CONSTANT[sex];
}

/** EN-02: requested pace capped at the lower of 1 kg a week and 1 per cent of body weight a week. */
export function fatLossRate(weightKg: number, requestedKgPerWeek: number = FAT_LOSS.defaultKgPerWeek): number {
  const cap = Math.min(FAT_LOSS.maxKgPerWeek, FAT_LOSS.maxFractionOfWeightPerWeek * weightKg);
  return Math.max(0, Math.min(requestedKgPerWeek, cap));
}

/** FD-01: plate guidance with no numbers at all. */
export function plateGuidance(reason: string): PlateTargets {
  return {
    mode: 'non_numeric',
    plate: [
      { share: 'half', part: 'Vegetables', examples: ['sabzi', 'salad', 'palak', 'bhindi'] },
      { share: 'quarter', part: 'Protein', examples: ['dal', 'paneer', 'eggs', 'chole', 'curd'] },
      { share: 'quarter', part: 'Grains', examples: ['roti', 'rice', 'poha'] },
    ],
    proteinPerMeal: 'A palm-sized portion or a katori of protein at each meal.',
    reasons: [{ ruleId: 'FD-01', text: reason }],
    ruleIds: ['FD-01'],
    needsReview: [],
  };
}

function missingEnergyInputs(i: TargetInput): string | null {
  const missing = [i.weightKg === null && 'weight', i.heightCm === null && 'height', i.ageYears === null && 'age'].filter(Boolean);
  if (missing.length > 0) return `No energy target yet: we need your ${missing.join(' and ')} and do not guess it.`;
  if (!inRange(i.weightKg!, RANGES.weightKg) || !inRange(i.heightCm!, RANGES.heightCm)) return 'No energy target: weight or height is outside the range we can estimate for.';
  if (i.ageYears! < 18) return 'No energy target: these estimates are for adults only.';
  return null;
}

function energyTarget(i: TargetInput, noDeficit: boolean, reasons: NumericTargets['reasons'], review: Set<string>): EnergyTarget {
  const w = i.weightKg!;
  const resting = restingEnergy(i.sex, w, i.heightCm!, i.ageYears!);
  const factor = ACTIVITY_FACTORS[i.activity];
  const tdee = resting * factor;
  const maintenance = { low: tdee * 0.9, high: tdee * 1.1 };
  const ruleIds = ['EN-01'];
  const assumptions = [
    `Activity factor ${factor} for "${i.activity}" activity is an assumption.`,
    'Resting energy uses the Mifflin-St Jeor equation, derived from US adults, so the target is a range of plus or minus 10 per cent.',
  ];
  if (i.sex === 'prefer_not_to_say') assumptions.push('Sex not given: the average of the male and female equations is used.');

  let kcal = { ...maintenance };
  let change: EnergyTarget['change'] = { kind: 'none', kcalPerDay: { low: 0, high: 0 } };
  const wantsChange = i.goal === 'fat_loss' || i.goal === 'muscle_gain';

  if (wantsChange && noDeficit) {
    ruleIds.push('EN-08');
    reasons.push({ ruleId: 'EN-08', text: 'Your health answers mean we keep you at maintenance, with no deficit or surplus.' });
  } else if (i.goal === 'fat_loss') {
    const rate = fatLossRate(w, i.lossKgPerWeek);
    const perDay = (rate * KCAL_PER_KG) / 7;
    kcal = { low: maintenance.low - perDay, high: maintenance.high - perDay };
    change = { kind: 'deficit', kcalPerDay: { low: perDay, high: perDay } };
    ruleIds.push('EN-02');
    assumptions.push(`${KCAL_PER_KG} kcal per kg of weight change is an approximation.`);
    reasons.push({ ruleId: 'EN-02', text: `Aiming for about ${Math.round(rate * 100) / 100} kg a week.` });
    if ((i.lossKgPerWeek ?? FAT_LOSS.defaultKgPerWeek) > rate) reasons.push({ ruleId: 'EN-02', text: 'The pace is capped at the lower of 1 kg and 1 per cent of your weight a week.' });
  } else if (i.goal === 'muscle_gain') {
    const beginner = i.experience === 'none' || i.experience === 'lt6m';
    const hiFrac = beginner ? MUSCLE_GAIN.beginnerHighFractionPerMonth : MUSCLE_GAIN.highFractionPerMonth;
    const perDay = (frac: number) => (frac * w * KCAL_PER_KG) / DAYS_PER_MONTH;
    const surplus = { low: perDay(MUSCLE_GAIN.lowFractionPerMonth), high: perDay(hiFrac) };
    kcal = { low: maintenance.low + surplus.low, high: maintenance.high + surplus.high };
    change = { kind: 'surplus', kcalPerDay: surplus };
    ruleIds.push('EN-05');
    review.add(NUTRITION_NEEDS_REVIEW[1]);
    assumptions.push(`${KCAL_PER_KG} kcal per kg of weight change is an approximation.`);
    reasons.push({ ruleId: 'EN-05', text: 'A small surplus, aiming to gain about half to one per cent of your weight a month.' });
  }

  // EN-03: the lower bound never goes below resting energy. If the whole range would, the target
  // becomes resting energy up to the low end of maintenance, which keeps it a range (EN-01).
  let floorApplied = false;
  if (kcal.low < resting) {
    floorApplied = true;
    kcal = { low: resting, high: kcal.high < resting ? maintenance.low : kcal.high };
    reasons.push({ ruleId: 'EN-03', text: 'The target never goes below your estimated resting energy, so the deficit is smaller.' });
  }
  ruleIds.push('EN-03');
  review.add(NUTRITION_NEEDS_REVIEW[0]);
  return { kcal, displayKcal: roundKcalRange(kcal), restingKcal: resting, activityFactor: factor, maintenanceKcal: maintenance, change, floorApplied, ruleIds, assumptions };
}

function proteinTarget(i: TargetInput, inDeficit: boolean, noHighProtein: boolean, review: Set<string>): ProteinTarget {
  const w = i.weightKg!;
  // Whole grams, rounded inward so the shown range never leaves the computed one.
  const grams = (g: { low: number; default: number; high: number | null }) => ({
    low: Math.ceil(g.low * w - 1e-9),
    default: Math.round(g.default * w),
    high: g.high === null ? null : Math.floor(g.high * w + 1e-9),
  });
  review.add(NUTRITION_NEEDS_REVIEW[3]);
  const f = PROTEIN_G_PER_KG.floor;
  if (noHighProtein) {
    const gPerKg = { low: f, default: f, high: f };
    return { kind: 'cap', gPerKg, grams: grams(gPerKg), ruleIds: ['PR-01', 'PR-04'], note: 'Kept at the general adult level because of a health condition. Ask your doctor before changing it.' };
  }
  if (TRAINING_GOALS.includes(i.goal) || inDeficit || i.resistanceTraining) {
    const gPerKg = { low: PROTEIN_G_PER_KG.low, default: PROTEIN_G_PER_KG.default, high: PROTEIN_G_PER_KG.high };
    return { kind: 'range', gPerKg, grams: grams(gPerKg), ruleIds: ['PR-01', 'PR-02'], note: 'Range for people who strength train or are in a deficit.' };
  }
  const gPerKg = { low: f, default: f, high: null };
  return { kind: 'floor', gPerKg, grams: grams(gPerKg), ruleIds: ['PR-01'], note: 'The general minimum for adults; more is fine.' };
}

/** Compute targets. Non-numeric mode returns plate guidance only, with no numbers at all. */
export function computeTargets(input: TargetInput): NutritionTargets {
  const c = codes(input.restrictions);
  if (c.has('non_numeric_only')) return plateGuidance('We show plate guidance instead of numbers.');
  if (input.preferNonNumeric) return plateGuidance('You chose plate guidance instead of numbers.');

  const reasons: NumericTargets['reasons'] = [];
  const review = new Set<string>();
  const noDeficit = c.has('no_deficit');
  const missing = missingEnergyInputs(input);
  const energy = missing ? null : energyTarget(input, noDeficit, reasons, review);
  const inDeficit = energy?.change.kind === 'deficit' || (input.goal === 'fat_loss' && !noDeficit);
  const weightOk = input.weightKg !== null && inRange(input.weightKg, RANGES.weightKg);
  const protein = weightOk ? proteinTarget(input, inDeficit, c.has('no_high_protein'), review) : null;
  if (protein?.kind === 'cap') reasons.push({ ruleId: 'PR-04', text: protein.note });

  const ruleIds = [...new Set([...(energy?.ruleIds ?? []), ...(protein?.ruleIds ?? []), ...FIBRE_GUIDANCE.ruleIds])];
  const out: NumericTargets = { mode: 'numeric', energy, protein, fibre: { ...FIBRE_GUIDANCE, ruleIds: [...FIBRE_GUIDANCE.ruleIds] }, reasons, ruleIds, needsReview: [...review] };
  if (missing) out.energyReason = missing;
  if (!protein)
    out.proteinReason = input.weightKg === null ? 'No protein target yet: we need your weight and do not guess it.' : 'No protein target: weight is outside the range we can estimate for.';
  return out;
}
