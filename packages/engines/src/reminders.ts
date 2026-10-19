/**
 * Reminder scheduling rules (plan/07 S31, F-20, guardrail in plan/17: median 5 or fewer a week).
 * Pure: returns the reminders to schedule; the app hands them to the OS. Push delivery is
 * best-effort, so nothing safety-critical ever depends on a reminder.
 */

export type ReminderCategory = 'session' | 'check_in' | 'weekly_review';

export interface ReminderPrefs {
  enabled: boolean;
  categories: Record<ReminderCategory, boolean>;
  /** "HH:MM" local time. */
  sessionTime: string;
  checkInTime: string;
  quietStart: string;
  quietEnd: string;
  /** ISO date; no reminders before this day. */
  pausedUntil?: string;
}

export const DEFAULT_REMINDERS: ReminderPrefs = {
  enabled: false,
  categories: { session: true, check_in: false, weekly_review: true },
  sessionTime: '18:00',
  checkInTime: '08:00',
  quietStart: '22:00',
  quietEnd: '07:00',
};

export interface PlannedReminder {
  id: string;
  category: ReminderCategory;
  /** YYYY-MM-DD */
  day: string;
  /** HH:MM local */
  time: string;
  title: string;
  body: string;
}

export const MAX_PER_WEEK = 5;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function inQuietHours(time: string, start: string, end: string): boolean {
  const t = toMin(time);
  const s = toMin(start);
  const e = toMin(end);
  return s <= e ? t >= s && t < e : t >= s || t < e;
}

/** Move a time out of quiet hours to the end of the quiet window. */
export function outsideQuietHours(time: string, start: string, end: string): string {
  return inQuietHours(time, start, end) ? end : time;
}

/**
 * Reminders for the week starting `weekStart` (Monday). `sessionDays` maps weekday index to the
 * day key and whether it is already done.
 */
export function planReminders(
  prefs: ReminderPrefs,
  week: { weekStart: string; sessions: { day: number; title: string; done: boolean }[]; today: string },
): PlannedReminder[] {
  if (!prefs.enabled) return [];
  const dayKey = (i: number) => new Date(Date.parse(`${week.weekStart}T12:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
  const out: PlannedReminder[] = [];
  const ok = (day: string) => day >= week.today && (!prefs.pausedUntil || day >= prefs.pausedUntil);

  if (prefs.categories.session) {
    for (const s of week.sessions) {
      const day = dayKey(s.day);
      if (s.done || !ok(day)) continue;
      out.push({ id: `session-${day}`, category: 'session', day, time: outsideQuietHours(prefs.sessionTime, prefs.quietStart, prefs.quietEnd), title: s.title, body: 'Your session is ready when you are. Short on time? You can shorten it.' });
    }
  }
  if (prefs.categories.weekly_review) {
    const day = dayKey(6);
    if (ok(day)) out.push({ id: `review-${day}`, category: 'weekly_review', day, time: outsideQuietHours('10:00', prefs.quietStart, prefs.quietEnd), title: 'Weekly review', body: 'Two minutes to look back at your week.' });
  }
  if (prefs.categories.check_in) {
    for (let i = 0; i < 7; i++) {
      const day = dayKey(i);
      if (ok(day)) out.push({ id: `checkin-${day}`, category: 'check_in', day, time: outsideQuietHours(prefs.checkInTime, prefs.quietStart, prefs.quietEnd), title: 'Quick check-in', body: 'Three taps: energy, time and any pain.' });
    }
  }
  // Cap the week: sessions first, then the review, then check-ins.
  const order: Record<ReminderCategory, number> = { session: 0, weekly_review: 1, check_in: 2 };
  return out.sort((a, b) => order[a.category] - order[b.category] || a.day.localeCompare(b.day)).slice(0, MAX_PER_WEEK).sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
}

export { toHHMM };
