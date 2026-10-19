import { EXERCISES, WARMUP_IDS } from './exercises';
import { isAllowed, maxLevelFor, minRir, trainingPaused } from './restrictions';
import type { Block, Exercise, Goal, Pattern, PlannedSession, Restriction, TrainingProfile, WeekPlan } from './types';

/**
 * Weekly plan builder (rules TR-01, TR-02, TR-10 in plan/13). Deterministic: same input, same week.
 * No randomness and no clock reads, so it can be tested and re-run on the server.
 */

const SLOTS: Record<PlannedSession['kind'], Pattern[]> = {
  full_a: ['squat', 'push_h', 'pull_h', 'hinge', 'core'],
  full_b: ['lunge', 'push_v', 'pull_v', 'hinge', 'core'],
  upper: ['push_h', 'pull_h', 'push_v', 'pull_v', 'core'],
  lower: ['squat', 'hinge', 'lunge', 'core', 'carry'],
};

const FALLBACK: Partial<Record<Pattern, Pattern>> = { pull_v: 'pull_h', push_v: 'push_h', lunge: 'squat', carry: 'core', squat: 'lunge' };

const TITLES: Record<PlannedSession['kind'], string> = {
  full_a: 'Full body A',
  full_b: 'Full body B',
  upper: 'Upper body',
  lower: 'Lower body',
};

const KINDS_BY_COUNT: Record<number, PlannedSession['kind'][]> = {
  1: ['full_a'],
  2: ['full_a', 'full_b'],
  3: ['full_a', 'full_b', 'full_a'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['upper', 'lower', 'full_a', 'upper', 'lower'],
  6: ['upper', 'lower', 'full_a', 'upper', 'lower', 'full_b'],
};

const HOLDS = new Set(['plank', 'side_plank', 'farmer_carry', 'suitcase_march']);

/** Timed holds are logged in seconds, not reps. */
export const isHoldExercise = (id: string) => HOLDS.has(id);
const WARMUP_MINUTES = 5;
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const isNovice = (p: TrainingProfile) => p.experience === 'none' || p.experience === 'lt6m';

/** Rep ranges by goal (TR-02). Novices stay in moderate ranges whatever the goal. */
function dose(goal: Goal, novice: boolean): { repMin: number; repMax: number; restSec: number } {
  if (novice) return goal === 'mobility' || goal === 'habits' ? { repMin: 10, repMax: 15, restSec: 45 } : { repMin: 8, repMax: 12, restSec: 75 };
  switch (goal) {
    case 'strength':
      return { repMin: 5, repMax: 8, restSec: 150 };
    case 'muscle_gain':
      return { repMin: 8, repMax: 12, restSec: 90 };
    case 'mobility':
    case 'habits':
      return { repMin: 10, repMax: 15, restSec: 45 };
    default:
      return { repMin: 10, repMax: 15, restSec: 60 };
  }
}

export function estimateMinutes(warmupItems: number, blocks: Block[]): number {
  const warm = warmupItems > 0 ? Math.max(3, Math.min(WARMUP_MINUTES, warmupItems * 2)) : 0;
  const work = blocks.reduce((sum, b) => {
    const perSetWork = b.unit === 'seconds' ? b.repMax : Math.min(60, b.repMax * 3.5);
    return sum + b.sets * (perSetWork + b.restSec);
  }, 0);
  return Math.round(warm + work / 60);
}

/** Spread n sessions over the available days, keeping at least one rest day (TR-10). */
export function pickTrainingDays(available: number[], wanted: number): number[] {
  const days = [...new Set(available)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const n = Math.min(wanted, days.length, 6);
  if (n <= 0) return [];
  if (n === days.length) return days;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(days[Math.floor((i * days.length) / n)]!);
  return [...new Set(out)];
}

function candidates(pattern: Pattern, profile: TrainingProfile, restrictions: Restriction[]): Exercise[] {
  const ctx = {
    equipment: new Set(profile.equipment),
    restrictions,
    maxLevel: maxLevelFor(profile.experience),
    avoid: new Set(profile.avoidExerciseIds ?? []),
  };
  return EXERCISES.filter((e) => e.pattern === pattern && isAllowed(e, ctx)).sort(
    (a, b) => b.level - a.level || (a.loaded === b.loaded ? 0 : a.loaded ? -1 : 1) || a.id.localeCompare(b.id),
  );
}

export interface WeekOptions {
  /** Accepted "lighter week" change (TR-04): roughly half the sets. */
  deload?: boolean;
  /** Accepted "add volume" changes (TR-05): extra sets on the first two exercises, max 2. */
  volumeBonus?: number;
}

function buildSession(
  kind: PlannedSession['kind'],
  day: number,
  variant: number,
  weekStart: string,
  profile: TrainingProfile,
  restrictions: Restriction[],
  options: WeekOptions,
): PlannedSession {
  const novice = isNovice(profile);
  const d = dose(profile.goal, novice);
  const rir = Math.max(novice ? 3 : 2, minRir(restrictions));
  const sets = novice ? 2 : 3;
  const used = new Set<string>();
  const blocks: Block[] = [];
  const ruleIds = new Set(['TR-01', 'TR-02']);

  for (const slot of SLOTS[kind]) {
    let pool = candidates(slot, profile, restrictions).filter((e) => !used.has(e.id));
    if (pool.length === 0 && FALLBACK[slot]) pool = candidates(FALLBACK[slot]!, profile, restrictions).filter((e) => !used.has(e.id));
    if (pool.length === 0) continue;
    const ex = pool[variant % pool.length]!;
    used.add(ex.id);
    const hold = HOLDS.has(ex.id);
    blocks.push({
      exerciseId: ex.id,
      sets,
      repMin: hold ? 20 : d.repMin,
      repMax: hold ? 40 : d.repMax,
      restSec: d.restSec,
      targetRir: rir,
      unit: hold ? 'seconds' : 'reps',
    });
  }

  const warmup = [...(kind === 'upper' ? WARMUP_IDS.upper : kind === 'lower' ? WARMUP_IDS.lower : WARMUP_IDS.full)];

  // Fit the session to the time the user has: drop accessories from the end, then trim sets.
  while (blocks.length > 2 && estimateMinutes(warmup.length, blocks) > profile.sessionMinutes) blocks.pop();
  for (let i = blocks.length - 1; i >= 0 && estimateMinutes(warmup.length, blocks) > profile.sessionMinutes; i--) {
    if (blocks[i]!.sets > 1) blocks[i] = { ...blocks[i]!, sets: blocks[i]!.sets - 1 };
  }

  const bonus = Math.min(2, Math.max(0, options.volumeBonus ?? 0));
  if (bonus > 0) {
    for (let i = 0; i < Math.min(2, blocks.length); i++) blocks[i] = { ...blocks[i]!, sets: Math.min(5, blocks[i]!.sets + bonus) };
    ruleIds.add('TR-05');
  }
  if (options.deload) {
    for (let i = 0; i < blocks.length; i++) blocks[i] = { ...blocks[i]!, sets: Math.max(1, Math.ceil(blocks[i]!.sets / 2)) };
    ruleIds.add('TR-04');
  }

  if (minRir(restrictions) > 1) ruleIds.add('LIMITED-MODE');
  return {
    id: `${weekStart}-d${day}`,
    day,
    title: TITLES[kind],
    kind,
    warmup,
    blocks,
    estimatedMinutes: estimateMinutes(warmup.length, blocks),
    ruleIds: [...ruleIds],
  };
}

/**
 * Build one week. `weekStart` is the Monday (YYYY-MM-DD) and only feeds stable session IDs.
 */
export function buildWeek(profile: TrainingProfile, restrictions: Restriction[], weekStart: string, options: WeekOptions = {}): WeekPlan {
  const reasons: WeekPlan['reasons'] = [];
  if (trainingPaused(restrictions)) {
    return {
      sessions: [],
      restDays: [0, 1, 2, 3, 4, 5, 6],
      paused: true,
      needsReview: [],
      reasons: [{ ruleId: 'SAFETY', text: 'Training is paused until the safety step is resolved. Logging and guidance still work.' }],
    };
  }

  const cap = isNovice(profile) ? 4 : 6;
  const days = pickTrainingDays(profile.daysAvailable, Math.min(cap, profile.daysAvailable.length));
  const kinds = KINDS_BY_COUNT[days.length] ?? [];
  const seen: Record<string, number> = {};
  const sessions = days.map((day, i) => {
    const kind = kinds[i]!;
    const variant = seen[kind] ?? 0;
    seen[kind] = variant + 1;
    return buildSession(kind, day, variant, weekStart, profile, restrictions, options);
  });

  const restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d));
  reasons.push({ ruleId: 'TR-01', text: `${sessions.length} session${sessions.length === 1 ? '' : 's'} on ${days.map((d) => DAY_NAMES[d]).join(', ')}` });
  if (sessions.length === 1) reasons.push({ ruleId: 'TR-01', text: 'Two sessions a week is the usual minimum; add a short home session if you can.' });
  reasons.push({ ruleId: 'TR-10', text: `Rest on ${restDays.map((d) => DAY_NAMES[d]).join(', ')}` });
  if (isNovice(profile) && profile.daysAvailable.length > cap) reasons.push({ ruleId: 'TR-01', text: `Capped at ${cap} sessions while you are starting out.` });
  if (minRir(restrictions) > 1) reasons.push({ ruleId: 'LIMITED-MODE', text: 'Everything stays light to moderate, with several reps in reserve.' });
  if (options.deload) reasons.push({ ruleId: 'TR-04', text: 'Lighter week: about half the usual sets' });
  if ((options.volumeBonus ?? 0) > 0) reasons.push({ ruleId: 'TR-05', text: `${options.volumeBonus} extra set${options.volumeBonus === 1 ? '' : 's'} on your main lifts` });
  const regions = restrictions.filter((r) => r.code.startsWith('region:'));
  if (regions.length) {
    const list = regions.map((r) => `${r.code.slice(7).replace('_', ' ')}${r.expiresAt ? ` until ${r.expiresAt}` : ''}`).join(', ');
    reasons.push({ ruleId: 'TR-07', text: `Leaving out moves that load your ${list}` });
  }

  const needsReview = ['TR-02 starting dose'];
  if (days.length >= 5) needsReview.push('TR-01 five or six day split');
  return { sessions, restDays, reasons, paused: false, needsReview };
}
