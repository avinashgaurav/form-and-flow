import { EXERCISES, getExercise } from './exercises';
import { estimateMinutes } from './planner';
import { isAllowed, maxLevelFor } from './restrictions';
import type { Block, Equipment, Exercise, Experience, LoggedSet, PlannedSession, Region, Restriction } from './types';
import { roundToStep } from './units';

/* ---------- Progression (TR-03) ---------- */

export type Feel = 'too_easy' | 'right' | 'too_hard';

export interface ProgressionInput {
  exerciseId: string;
  block: Block;
  currentLoadKg: number;
  /** Logged sets per session, oldest first. */
  history: LoggedSet[][];
  feel?: Feel;
  loadStepKg?: number;
}

export interface ProgressionResult {
  action: 'increase_load' | 'hold' | 'decrease_load' | 'suggest_harder' | 'suggest_easier';
  loadKg: number;
  ruleId: 'TR-03';
  reason: string;
}

function defaultStep(ex: Exercise | undefined): number {
  if (!ex) return 2.5;
  return ex.allOf.includes('barbell') || ex.anyOf.includes('machines') || ex.anyOf.includes('cable') ? 2.5 : 1;
}

const belowRange = (sets: LoggedSet[], repMin: number) => sets.some((s) => s.reps < repMin);

export function nextTarget(input: ProgressionInput): ProgressionResult {
  const ex = getExercise(input.exerciseId);
  const step = input.loadStepKg ?? defaultStep(ex);
  const last = input.history.at(-1);
  const prev = input.history.at(-2);
  const hold = (reason: string): ProgressionResult => ({ action: 'hold', loadKg: input.currentLoadKg, ruleId: 'TR-03', reason });

  if (!last || last.length === 0) return hold('No logged sets yet.');

  if (prev && belowRange(last, input.block.repMin) && belowRange(prev, input.block.repMin)) {
    if (!ex?.loaded) return { action: 'suggest_easier', loadKg: 0, ruleId: 'TR-03', reason: 'Below the rep range two sessions running; try the easier version.' };
    const next = Math.max(0, roundToStep(input.currentLoadKg * 0.9, step));
    return { action: 'decrease_load', loadKg: next, ruleId: 'TR-03', reason: 'Below the rep range two sessions running, so the load drops about 10 per cent.' };
  }

  if (input.feel === 'too_hard') return hold('You said the last session felt too hard, so the load stays the same.');

  const topOfRange = last.length >= input.block.sets && last.every((s) => s.reps >= input.block.repMax && (s.rir ?? 2) >= 2);
  if (!topOfRange) return hold('Keep this load until every set reaches the top of the range.');

  if (!ex?.loaded) return { action: 'suggest_harder', loadKg: 0, ruleId: 'TR-03', reason: 'Every set reached the top of the range; try a harder version.' };
  return {
    action: 'increase_load',
    loadKg: roundToStep(input.currentLoadKg + step, step),
    ruleId: 'TR-03',
    reason: `Every set reached ${input.block.repMax} reps with reps to spare, so add ${step} kg.`,
  };
}

/* ---------- Deload (TR-04) and return after a break (TR-08) ---------- */

export function deloadDue(input: { weeksSinceDeload: number; performanceDrops: number; energy?: number }): 'scheduled' | 'triggered' | null {
  if (input.performanceDrops >= 2 && (input.energy ?? 5) <= 2) return 'triggered';
  if (input.weeksSinceDeload >= 5) return 'scheduled';
  return null;
}

export function applyDeload(session: PlannedSession): PlannedSession {
  const blocks = session.blocks.map((b) => ({ ...b, sets: Math.max(1, Math.ceil(b.sets / 2)) }));
  return { ...session, blocks, estimatedMinutes: estimateMinutes(session.warmup.length, blocks), ruleIds: [...session.ruleIds, 'TR-04'] };
}

export function returnAfterBreak(daysOff: number): { volumeFactor: number; loadFactor: number } {
  if (daysOff >= 21) return { volumeFactor: 0.7, loadFactor: 0.55 };
  if (daysOff >= 7) return { volumeFactor: 0.7, loadFactor: 1 };
  return { volumeFactor: 1, loadFactor: 1 };
}

/* ---------- Shorten (TR-06) ---------- */

export type ShortenResult =
  | { kind: 'session'; session: PlannedSession; cut: string[] }
  | { kind: 'alternative'; options: ('mobility' | 'walk')[]; reason: string };

/** Keep a short warm-up and the main lift, then add exercises in order while they fit. Never raises intensity. */
export function shortenSession(session: PlannedSession, minutes: number): ShortenResult {
  if (minutes < 10) return { kind: 'alternative', options: ['mobility', 'walk'], reason: 'Under 10 minutes, a short mobility routine or a walk is the better choice.' };
  const warmup = session.warmup.slice(0, 2);
  const kept: Block[] = [];
  for (const b of session.blocks) {
    if (kept.length === 0) {
      kept.push({ ...b });
      continue;
    }
    // Fit the next exercise with as many of its sets as the time allows (at least one).
    for (let sets = b.sets; sets >= 1; sets--) {
      if (estimateMinutes(warmup.length, [...kept, { ...b, sets }]) <= minutes) {
        kept.push({ ...b, sets });
        break;
      }
    }
  }
  while (estimateMinutes(warmup.length, kept) > minutes && kept[0]!.sets > 1) kept[0] = { ...kept[0]!, sets: kept[0]!.sets - 1 };
  const keptIds = new Set(kept.map((b) => b.exerciseId));
  return {
    kind: 'session',
    session: { ...session, warmup, blocks: kept, estimatedMinutes: estimateMinutes(warmup.length, kept), ruleIds: [...session.ruleIds, 'TR-06'] },
    cut: session.blocks.filter((b) => !keptIds.has(b.exerciseId)).map((b) => b.exerciseId),
  };
}

/* ---------- Substitution (TR-07) ---------- */

export function substitutes(
  exerciseId: string,
  ctx: { equipment: Equipment[]; restrictions: Restriction[]; experience: Experience; avoid?: string[] },
): Exercise[] {
  const ex = getExercise(exerciseId);
  if (!ex) return [];
  const allowedCtx = {
    equipment: new Set(ctx.equipment),
    restrictions: ctx.restrictions,
    maxLevel: maxLevelFor(ctx.experience),
    avoid: new Set([exerciseId, ...(ctx.avoid ?? [])]),
  };
  return EXERCISES.filter((e) => e.pattern === ex.pattern && Math.abs(e.level - ex.level) <= 1 && isAllowed(e, allowedCtx))
    .sort((a, b) => Math.abs(a.level - ex.level) - Math.abs(b.level - ex.level) || a.id.localeCompare(b.id))
    .slice(0, 3);
}

/* ---------- Pain response (plan/14 section 3) ---------- */

export interface PainReport {
  region: Region;
  /** 0 to 10 */
  rating: number;
  sharp?: boolean;
  swelling?: boolean;
  numbness?: boolean;
  /** Any red-flag symptom answered yes (chest pain, fainting, severe breathlessness, one-sided weakness). */
  redFlag?: boolean;
}

export type PainAction =
  | { action: 'emergency' }
  | { action: 'end_session'; restriction: Restriction; advice: string }
  | { action: 'stop_exercise'; restriction: Restriction; advice: string }
  | { action: 'continue_lighter'; advice: string };

function addDays(day: string, n: number): string {
  const t = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function assessPain(report: PainReport, today: string): PainAction {
  if (report.redFlag) return { action: 'emergency' };
  const restriction: Restriction = { code: `region:${report.region}`, source: 'pain_report', expiresAt: addDays(today, 7) };
  if (report.rating >= 7 || report.sharp || report.swelling || report.numbness) {
    return { action: 'end_session', restriction, advice: 'End the session here. Please get it checked by a doctor or physiotherapist, especially if it does not settle.' };
  }
  if (report.rating >= 4) {
    return { action: 'stop_exercise', restriction, advice: 'Stop this exercise. We will leave out moves that load this area for 7 days. If it lasts longer or gets worse, see a physiotherapist.' };
  }
  return { action: 'continue_lighter', advice: 'Mild, familiar soreness is common after training. You can continue lighter or stop; stop if it sharpens.' };
}
