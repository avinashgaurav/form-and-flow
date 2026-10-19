/**
 * Shared domain types. No I/O, no React: this package runs on the phone and the server.
 * Rule IDs in comments (TR-, EN-, PR-) refer to plan/13-ai-and-evidence-governance.md.
 */

export type Goal = 'fat_loss' | 'muscle_gain' | 'strength' | 'fitness' | 'mobility' | 'habits' | 'maintenance';
export type Experience = 'none' | 'lt6m' | '6to24m' | 'gt2y';
export type TrainingLocation = 'home' | 'gym' | 'both';

export type Equipment =
  | 'dumbbells'
  | 'kettlebell'
  | 'bands'
  | 'bench'
  | 'barbell'
  | 'rack'
  | 'cable'
  | 'machines'
  | 'pullup_bar';

export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push_h'
  | 'push_v'
  | 'pull_h'
  | 'pull_v'
  | 'core'
  | 'carry'
  | 'mobility';

/** Tags an exercise carries so restrictions can exclude it. Maintained with the S&C reviewer. */
export type ContraTag =
  | 'heavy'
  | 'breath_hold'
  | 'impact'
  | 'deep_knee_flexion_loaded'
  | 'knee_load'
  | 'spinal_flexion_loaded'
  | 'heavy_hinge'
  | 'overhead'
  | 'shoulder_end_range'
  | 'wrist_load';

export type Region = 'knee' | 'lower_back' | 'shoulder' | 'wrist' | 'hip' | 'ankle' | 'elbow' | 'neck';

export type Level = 1 | 2 | 3;

export type ReviewStatus = 'draft' | 'approved';

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  pattern: Pattern;
  /** Needs at least one of these. Empty means no equipment needed. */
  anyOf: Equipment[];
  /** Needs all of these, on top of anyOf. */
  allOf: Equipment[];
  level: Level;
  tags: ContraTag[];
  cues: string[];
  mistakes: string[];
  /** Loaded movements progress by kilograms; bodyweight ones by reps then a harder variation. */
  loaded: boolean;
  reviewStatus: ReviewStatus;
}

export type RestrictionCode =
  | 'red_flag'
  | 'pregnancy'
  | 'clearance_required'
  | 'intensity_cap_moderate'
  | 'no_deficit'
  | 'no_high_protein'
  | 'no_fasted_training'
  | 'non_numeric_only'
  | `region:${Region}`;

export interface Restriction {
  code: RestrictionCode;
  source: 'assessment' | 'pain_report' | 'user';
  /** ISO date; absent means until changed. */
  expiresAt?: string;
}

export interface TrainingProfile {
  goal: Goal;
  experience: Experience;
  location: TrainingLocation;
  equipment: Equipment[];
  /** 0 = Monday ... 6 = Sunday */
  daysAvailable: number[];
  sessionMinutes: number;
  avoidExerciseIds?: string[];
}

export interface Block {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  /** Target reps in reserve. Higher means easier. */
  targetRir: number;
  /** Most exercises count reps; holds such as planks count seconds. */
  unit: 'reps' | 'seconds';
}

export interface PlannedSession {
  id: string;
  /** 0 = Monday ... 6 = Sunday */
  day: number;
  title: string;
  kind: 'full_a' | 'full_b' | 'upper' | 'lower';
  warmup: string[];
  blocks: Block[];
  estimatedMinutes: number;
  ruleIds: string[];
}

export interface WeekPlan {
  sessions: PlannedSession[];
  restDays: number[];
  /** Why the week looks like this, as rule IDs and short reasons. */
  reasons: { ruleId: string; text: string }[];
  /** Training is paused, for example after a red flag or for pregnancy. */
  paused: boolean;
  /** Rules used that still need a qualified reviewer's sign-off. */
  needsReview: string[];
}

export interface LoggedSet {
  reps: number;
  loadKg: number;
  /** Reps in reserve the user reported, if any. */
  rir?: number;
}
