import { daysBetween } from '../days';
import { KCAL_PER_KG } from './targets';

/**
 * Adaptive expenditure (plan/13 EN-04, EN-06, EN-07). Replaces the EN-01 estimate once the user has
 * logged enough: expenditure is about average intake minus the trend-weight change times 7,700 kcal
 * per kg (a flagged approximation).
 *
 * EN-07, never react to a single day: the target changes at most once a week, so a big day today
 * never lowers tomorrow's target. At the weekly update, unlogged days are left out (never counted as
 * zero), weight is smoothed so one heavy weigh-in moves the trend by a tenth, and the change is capped
 * at 10 per cent of the current target.
 *
 * Known limit for the reviewer: an exponential trend lags real change, so in the first weeks the
 * slope, and with it the expenditure change, is underestimated. The 10 per cent cap and the EN-03
 * floor bound the effect.
 */

export interface DayIntake {
  /** Logical day, YYYY-MM-DD. */
  day: string;
  kcal: number;
}

export interface WeighIn {
  day: string;
  kg: number;
}

export interface AdaptiveInput {
  /** Daily intake totals for the window to analyse (for example the last 28 days). Unlogged days are absent. */
  intake: DayIntake[];
  weighIns: WeighIn[];
  /** The day the target is for. Only days before it count, since today is not over. */
  today: string;
  currentTargetKcal: number;
  /** Planned difference from expenditure: negative for a deficit, positive for a surplus, 0 for maintenance. */
  goalDeltaKcal: number;
  /** Day of the last target change. Changes happen at most once a week. */
  lastUpdateDay?: string;
  /** EN-03 floor, usually resting energy from targets.ts. */
  floorKcal?: number;
}

export const ADAPTIVE_MIN = { historyDays: 14, loggedDays: 10, weighIns: 8, adherence: 0.7 } as const;
export const TREND_ALPHA = 0.1;
export const WEEKLY_CHANGE_CAP = 0.1;
export const UPDATE_EVERY_DAYS = 7;

export type AdaptiveResult =
  | { status: 'insufficient_data'; reason: string; targetKcal: number; ruleIds: string[] }
  | { status: 'not_due'; reason: string; targetKcal: number; nextUpdateDay: string; ruleIds: string[] }
  | {
      status: 'updated';
      targetKcal: number;
      expenditureKcal: number;
      averageIntakeKcal: number;
      trendSlopeKgPerDay: number;
      latestTrendKg: number;
      capped: boolean;
      floorApplied: boolean;
      ruleIds: string[];
      assumptions: string[];
    };

/** Exponentially weighted moving average of weigh-ins, oldest first. Several on one day are averaged. */
export function trendWeights(weighIns: WeighIn[], alpha: number = TREND_ALPHA): { day: string; kg: number; trendKg: number }[] {
  const byDay = new Map<string, number[]>();
  for (const w of weighIns) byDay.set(w.day, [...(byDay.get(w.day) ?? []), w.kg]);
  const days = [...byDay.keys()].sort();
  let trend: number | null = null;
  return days.map((day) => {
    const list = byDay.get(day)!;
    const kg = list.reduce((a, b) => a + b, 0) / list.length;
    trend = trend === null ? kg : trend + alpha * (kg - trend);
    return { day, kg, trendKg: trend };
  });
}

/** Least-squares slope of y against x. */
function slope(points: { x: number; y: number }[]): number {
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  const sxx = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  const sxy = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  return sxx === 0 ? 0 : sxy / sxx;
}

const addDays = (day: string, n: number) => new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + n)).toISOString().slice(0, 10);

export function adaptiveUpdate(input: AdaptiveInput): AdaptiveResult {
  const hold = input.currentTargetKcal;
  if (input.lastUpdateDay && daysBetween(input.lastUpdateDay, input.today) < UPDATE_EVERY_DAYS) {
    return {
      status: 'not_due',
      reason: 'The target changes at most once a week, never in response to a single day.',
      targetKcal: hold,
      nextUpdateDay: addDays(input.lastUpdateDay, UPDATE_EVERY_DAYS),
      ruleIds: ['EN-04', 'EN-07'],
    };
  }

  const intakeByDay = new Map<string, number>();
  for (const d of input.intake) if (d.day < input.today) intakeByDay.set(d.day, (intakeByDay.get(d.day) ?? 0) + d.kcal);
  const weighIns = input.weighIns.filter((w) => w.day < input.today);
  const allDays = [...intakeByDay.keys(), ...weighIns.map((w) => w.day)].sort();
  const historyDays = allDays.length === 0 ? 0 : daysBetween(allDays[0]!, input.today);
  const trend = trendWeights(weighIns);
  const insufficient = (reason: string): AdaptiveResult => ({ status: 'insufficient_data', reason, targetKcal: hold, ruleIds: ['EN-04', 'EN-06'] });

  if (historyDays < ADAPTIVE_MIN.historyDays) return insufficient(`Not enough data yet: ${historyDays} of ${ADAPTIVE_MIN.historyDays} days of history.`);
  if (intakeByDay.size < ADAPTIVE_MIN.loggedDays) return insufficient(`Not enough data yet: ${intakeByDay.size} of ${ADAPTIVE_MIN.loggedDays} logged days.`);
  if (trend.length < ADAPTIVE_MIN.weighIns) return insufficient(`Not enough data yet: ${trend.length} of ${ADAPTIVE_MIN.weighIns} weigh-ins.`);
  if (intakeByDay.size / historyDays < ADAPTIVE_MIN.adherence) return insufficient('Not enough data yet: food was logged on fewer than 70 per cent of days.');

  const averageIntakeKcal = [...intakeByDay.values()].reduce((a, b) => a + b, 0) / intakeByDay.size;
  const first = trend[0]!.day;
  const trendSlopeKgPerDay = slope(trend.map((t) => ({ x: daysBetween(first, t.day), y: t.trendKg })));
  const expenditureKcal = averageIntakeKcal - trendSlopeKgPerDay * KCAL_PER_KG;

  const proposed = expenditureKcal + input.goalDeltaKcal;
  const lo = hold * (1 - WEEKLY_CHANGE_CAP);
  const hi = hold * (1 + WEEKLY_CHANGE_CAP);
  let targetKcal = Math.min(hi, Math.max(lo, proposed));
  const capped = targetKcal !== proposed;
  const ruleIds = ['EN-04', 'EN-07'];
  let floorApplied = false;
  if (input.floorKcal !== undefined && targetKcal < input.floorKcal) {
    targetKcal = input.floorKcal;
    floorApplied = true;
    ruleIds.push('EN-03');
  }
  return {
    status: 'updated',
    targetKcal,
    expenditureKcal,
    averageIntakeKcal,
    trendSlopeKgPerDay,
    latestTrendKg: trend.at(-1)!.trendKg,
    capped,
    floorApplied,
    ruleIds,
    assumptions: [`${KCAL_PER_KG} kcal per kg of weight change is an approximation.`],
  };
}
