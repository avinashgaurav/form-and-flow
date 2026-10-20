/**
 * Day boundaries in the user's timezone. A meal logged at 00:30 usually belongs to the day before,
 * so anything before the cutoff hour (default 04:00) defaults to the previous day (plan/07 S11, EC-21).
 */

export const DEFAULT_CUTOFF_HOUR = 4;

function partsIn(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), wd: String(p.weekday) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Calendar day (YYYY-MM-DD) of an instant in a timezone, ignoring the cutoff. */
export function calendarDay(date: Date, timeZone: string): string {
  const { y, m, d } = partsIn(date, timeZone);
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** The day an event "belongs to": before the cutoff hour it counts as the previous day. */
export function logicalDay(date: Date, timeZone: string, cutoffHour = DEFAULT_CUTOFF_HOUR): string {
  const { h } = partsIn(date, timeZone);
  if (h >= cutoffHour) return calendarDay(date, timeZone);
  return calendarDay(new Date(date.getTime() - (h + 1) * 3_600_000), timeZone);
}

/** True when the app should ask "which day does this belong to?" */
export function isLateNight(date: Date, timeZone: string, cutoffHour = DEFAULT_CUTOFF_HOUR): boolean {
  return partsIn(date, timeZone).h < cutoffHour;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** 0 = Monday ... 6 = Sunday, in the given timezone. */
export function weekdayIndex(date: Date, timeZone: string): number {
  return WEEKDAYS.indexOf(partsIn(date, timeZone).wd);
}

/** Whole days between two YYYY-MM-DD keys (b minus a). */
export function daysBetween(a: string, b: string): number {
  const ta = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const tb = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((tb - ta) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-10-26" as "26 Oct", for sentences people read. */
export function shortDay(isoDay: string): string {
  const [, m, d] = isoDay.slice(0, 10).split('-').map(Number);
  return m && m <= 12 && d ? `${d} ${MONTHS[m - 1]}` : isoDay;
}
