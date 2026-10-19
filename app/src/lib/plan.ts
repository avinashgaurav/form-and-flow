import {
  activeRestrictions,
  buildWeek,
  daysBetween,
  estimateMinutes,
  getExercise,
  logicalDay,
  nextTarget,
  weekdayIndex,
  type Block,
  type PlannedSession,
  type ProgressionResult,
} from '@ff/engines';
import type { AppState, PlanState, SessionLog, SetLog } from '../store/types';

export const ENGINE_VERSION = 'engines-0.1.0';

export const deviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
};

export function todayKey(tz: string, now = new Date()): string {
  return logicalDay(now, tz);
}

export function mondayOf(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const idx = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - idx * 86_400_000).toISOString().slice(0, 10);
}

export function makePlan(state: AppState, version: number, now = new Date()): PlanState | undefined {
  if (!state.profile) return undefined;
  const tz = state.profile.timezone;
  const today = todayKey(tz, now);
  const restrictions = activeRestrictions(state.restrictions, today);
  const weekStart = mondayOf(today);
  const options = { deload: state.planOptions.deloadWeekStart === weekStart, volumeBonus: state.planOptions.volumeBonus };
  return { version, weekStart, week: buildWeek(state.profile.training, restrictions, weekStart, options) };
}

/**
 * The week is recomputed from the profile and the limits active today, so a new pain limit or an
 * expired one takes effect at once, and the plan rolls forward each Monday. buildWeek is
 * deterministic, so an unchanged input gives an unchanged week. Sessions already started keep
 * their own snapshot (SessionLog.planned).
 */
export function currentPlan(state: AppState, now = new Date()): PlanState | undefined {
  if (!state.plan || !state.profile) return state.plan;
  return { ...makePlan(state, state.plan.version, now)!, acceptedAt: state.plan.acceptedAt };
}

/** The planned session for a key, preferring the snapshot taken when the session started. */
export function plannedFor(state: AppState, key: string, now = new Date()): PlannedSession | undefined {
  return state.sessions[key]?.planned ?? currentPlan(state, now)?.week.sessions.find((s) => s.id === key);
}

export function todayIndex(state: AppState, now = new Date()): number {
  return weekdayIndex(now, state.profile?.timezone ?? deviceTimeZone());
}

/** The session as the user will actually do it: shortened and with swaps applied. */
export function effectiveSession(planned: PlannedSession, log?: SessionLog): PlannedSession {
  const base = log?.shortened
    ? { ...planned, blocks: log.shortened.blocks, warmup: log.shortened.warmup, estimatedMinutes: estimateMinutes(log.shortened.warmup.length, log.shortened.blocks) }
    : planned;
  if (!log || Object.keys(log.swaps).length === 0) return base;
  return { ...base, blocks: base.blocks.map((b) => ({ ...b, exerciseId: log.swaps[b.exerciseId] ?? b.exerciseId })) };
}

export function setsFor(sets: SetLog[], sessionKey: string, exerciseId: string): SetLog[] {
  return sets.filter((s) => s.sessionKey === sessionKey && s.exerciseId === exerciseId).sort((a, b) => a.setIndex - b.setIndex);
}

/** Previous sessions' sets for one exercise, oldest first, excluding the current session. */
export function historyFor(sets: SetLog[], exerciseId: string, excludeSession?: string): SetLog[][] {
  const bySession = new Map<string, SetLog[]>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.sessionKey === excludeSession) continue;
    bySession.set(s.sessionKey, [...(bySession.get(s.sessionKey) ?? []), s]);
  }
  return [...bySession.values()].sort((a, b) => a[0]!.at.localeCompare(b[0]!.at));
}

export function suggestion(sets: SetLog[], block: Block, sessionKey: string, feel?: SessionLog['feel']): ProgressionResult & { lastLoad: number } {
  const history = historyFor(sets, block.exerciseId, sessionKey);
  const last = history.at(-1);
  const lastLoad = last ? Math.max(...last.map((s) => s.loadKg)) : 0;
  const r = nextTarget({ exerciseId: block.exerciseId, block, currentLoadKg: lastLoad, history: history.map((h) => h.map((s) => ({ reps: s.reps, loadKg: s.loadKg, rir: s.rir }))), feel });
  return { ...r, lastLoad };
}

export function daysSinceLastWorkout(state: AppState, today: string): number | null {
  const done = Object.values(state.sessions).filter((s) => (s.status === 'completed' || s.status === 'partial') && s.endedAt);
  if (done.length === 0) return null;
  const last = done.map((s) => s.endedAt!.slice(0, 10)).sort().at(-1)!;
  return daysBetween(last, today);
}

export const exerciseName = (id: string) => getExercise(id)?.name ?? id;

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Weeks since the last lighter week, or since the plan started. */
export function weeksSinceDeload(state: AppState, today: string): number {
  const from = state.planOptions.deloadWeekStart ?? (state.plan?.acceptedAt ? mondayOf(state.plan.acceptedAt.slice(0, 10)) : mondayOf(today));
  return Math.max(0, Math.floor(daysBetween(from, mondayOf(today)) / 7));
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
