/**
 * Progress maths (plan/07 S25, S26). Pure. Shows only what was logged: no projections, a trend
 * only after a week of data, and a trend line that breaks across long gaps instead of guessing.
 */
import { TREND_ALPHA } from './nutrition/adaptive';

export interface WeightEntry {
  id: string;
  kg: number;
  /** ISO time of the weigh-in. */
  at: string;
  /** Logical day (YYYY-MM-DD). */
  day: string;
  /** Set on every edit; when two phones disagree, the newest edit wins. */
  updatedAt?: string;
}

export interface WeightPoint {
  day: string;
  /** The latest entry that day (S26: duplicates are kept, the latest counts). */
  kg: number;
  /** Smoothed trend; restarts after a gap. */
  trendKg: number;
  /** Increments after every gap of GAP_DAYS or more, so charts draw separate lines. */
  segment: number;
}

/** A gap this long or longer breaks the trend line (S26). */
export const GAP_DAYS = 7;
/** A trend needs weigh-ins on dates at least a week apart, first to last (S25: "after a week"). */
export const MIN_TREND_DAYS = 6;

const dayMs = (d: string) => Date.parse(`${d}T12:00:00Z`);
const daysBetween = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / 86_400_000);

export function weightPoints(entries: WeightEntry[], alpha: number = TREND_ALPHA): WeightPoint[] {
  const latest = new Map<string, WeightEntry>();
  for (const e of entries) {
    const cur = latest.get(e.day);
    // Compare instants, not strings, so "+05:30" and "Z" times order correctly.
    if (!cur || Date.parse(e.at) > Date.parse(cur.at)) latest.set(e.day, e);
  }
  const days = [...latest.keys()].sort();
  const out: WeightPoint[] = [];
  let trend = 0;
  let segment = 0;
  for (let i = 0; i < days.length; i++) {
    const kg = latest.get(days[i]!)!.kg;
    const gap = i > 0 && daysBetween(days[i - 1]!, days[i]!) >= GAP_DAYS;
    if (i === 0 || gap) {
      if (gap) segment++;
      trend = kg;
    } else {
      trend += alpha * (kg - trend);
    }
    out.push({ day: days[i]!, kg, trendKg: Math.round(trend * 10) / 10, segment });
  }
  return out;
}

export type TrendSummary =
  | { status: 'too_early'; daysOfData: number }
  | { status: 'ok'; fromDay: string; toDay: string; changeKg: number; days: number };

/**
 * Trend change over about `window` days, within the latest unbroken stretch only. Never a forecast.
 */
export function weightTrendSummary(points: WeightPoint[], window = 28): TrendSummary {
  if (!points.length) return { status: 'too_early', daysOfData: 0 };
  const last = points[points.length - 1]!;
  const stretch = points.filter((p) => p.segment === last.segment);
  const span = daysBetween(stretch[0]!.day, last.day);
  if (span < MIN_TREND_DAYS) return { status: 'too_early', daysOfData: span + 1 };
  const from = stretch.find((p) => daysBetween(p.day, last.day) <= window) ?? stretch[0]!;
  return { status: 'ok', fromDay: from.day, toDay: last.day, changeKg: Math.round((last.trendKg - from.trendKg) * 10) / 10, days: daysBetween(from.day, last.day) };
}

/** Completed workouts per week (Monday weeks), oldest first, including weeks with none. */
export function workoutsPerWeek(completedDays: string[], lastMonday: string, weeks = 8): { weekStart: string; count: number }[] {
  const out: { weekStart: string; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(dayMs(lastMonday) - i * 7 * 86_400_000).toISOString().slice(0, 10);
    const count = completedDays.filter((d) => d >= start && daysBetween(start, d) < 7).length;
    out.push({ weekStart: start, count });
  }
  return out;
}

/** Segments long enough to show a trend line; shorter ones show their dots only. */
export function trendSegments(points: WeightPoint[]): Set<number> {
  const out = new Set<number>();
  for (const seg of new Set(points.map((p) => p.segment))) {
    const pts = points.filter((p) => p.segment === seg);
    if (daysBetween(pts[0]!.day, pts[pts.length - 1]!.day) >= MIN_TREND_DAYS) out.add(seg);
  }
  return out;
}
