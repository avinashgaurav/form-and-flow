import type { ContraTag, Equipment, Exercise, Experience, Level, Restriction, RestrictionCode } from './types';

/**
 * Restriction to excluded-tag mapping (plan/14 section 4). Draft values for the founder pilot;
 * the S&C reviewer or physiotherapist owns this table before beta (Q-15).
 */
export const EXCLUDED_TAGS: Partial<Record<RestrictionCode, ContraTag[]>> = {
  intensity_cap_moderate: ['heavy', 'breath_hold', 'impact'],
  'region:knee': ['deep_knee_flexion_loaded', 'knee_load', 'impact'],
  'region:lower_back': ['spinal_flexion_loaded', 'heavy_hinge', 'impact', 'heavy'],
  'region:shoulder': ['overhead', 'shoulder_end_range'],
  'region:wrist': ['wrist_load'],
  'region:hip': ['deep_knee_flexion_loaded', 'impact'],
  'region:ankle': ['impact', 'knee_load'],
};

/** Codes that pause all programmed training (education and logging still work). */
const PAUSING: RestrictionCode[] = ['red_flag', 'pregnancy', 'clearance_required'];

export function activeRestrictions(all: Restriction[], today: string): Restriction[] {
  return all.filter((r) => !r.expiresAt || r.expiresAt >= today);
}

export function codes(all: Restriction[]): Set<RestrictionCode> {
  return new Set(all.map((r) => r.code));
}

export function trainingPaused(all: Restriction[]): boolean {
  const c = codes(all);
  return PAUSING.some((p) => c.has(p));
}

export function excludedTags(all: Restriction[]): Set<ContraTag> {
  const out = new Set<ContraTag>();
  for (const r of all) for (const t of EXCLUDED_TAGS[r.code] ?? []) out.add(t);
  return out;
}

export function maxLevelFor(experience: Experience): Level {
  if (experience === 'none' || experience === 'lt6m') return 1;
  if (experience === '6to24m') return 2;
  return 3;
}

export function hasEquipment(ex: Exercise, available: ReadonlySet<Equipment>): boolean {
  const anyOk = ex.anyOf.length === 0 || ex.anyOf.some((e) => available.has(e));
  const allOk = ex.allOf.every((e) => available.has(e));
  return anyOk && allOk;
}

/** Is this exercise allowed for this user right now? Equipment, restrictions, level and explicit avoids. */
export function isAllowed(
  ex: Exercise,
  ctx: { equipment: ReadonlySet<Equipment>; restrictions: Restriction[]; maxLevel: Level; avoid?: ReadonlySet<string> },
): boolean {
  if (ctx.avoid?.has(ex.id)) return false;
  if (ex.level > ctx.maxLevel) return false;
  if (!hasEquipment(ex, ctx.equipment)) return false;
  const banned = excludedTags(ctx.restrictions);
  return !ex.tags.some((t) => banned.has(t));
}

/** Minimum reps in reserve: intensity cap keeps everything clearly submaximal (limited mode, plan/08). */
export function minRir(all: Restriction[]): number {
  return codes(all).has('intensity_cap_moderate') ? 3 : 1;
}
