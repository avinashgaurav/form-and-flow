import { DEFAULT_COACH_MODEL, DEFAULT_REMINDERS, type AllergenTag, type CoachModelId, type Diet, type FoodRef, type FoodUnit, type LogSnapshot, type OilLevel, type Sex, type Answer, type Block, type Goal, type PlannedSession, type QuestionId, type ReadinessResult, type Region, type ReminderPrefs, type Restriction, type TrainingProfile, type WeekPlan } from '@ff/engines';

export const NOTICE_VERSION = 'notice-draft-2026-10-19';

export interface Profile {
  birthYear: number;
  units: 'metric' | 'imperial';
  tone: 'direct' | 'gentle' | 'data';
  timezone: string;
  goal: Goal;
  heightCm?: number;
  weightKg?: number;
  activity?: 'low' | 'light' | 'moderate' | 'high';
  training: TrainingProfile;
}

export interface Consents {
  core: boolean;
  aiProcessing: boolean;
  version: string;
  at: string;
}

export interface ReadinessState {
  answers: Partial<Record<QuestionId, Answer>>;
  regions: Region[];
  clearance: boolean;
  result: ReadinessResult;
  at: string;
}

export interface PlanState {
  version: number;
  weekStart: string;
  week: WeekPlan;
  acceptedAt?: string;
}

/** One logged set. `id` is the client operation ID: writing it twice never duplicates (EC-02, EC-03). */
export interface SetLog {
  id: string;
  sessionKey: string;
  exerciseId: string;
  setIndex: number;
  reps: number;
  loadKg: number;
  rir?: number;
  at: string;
}

export interface SessionLog {
  key: string;
  status: 'planned' | 'in_progress' | 'completed' | 'partial';
  startedAt: string;
  endedAt?: string;
  feel?: 'too_easy' | 'right' | 'too_hard';
  /** Original exercise ID to its substitute (TR-07). */
  swaps: Record<string, string>;
  /** The planned session as it was when the user started it, so later plan changes never alter a session in progress. */
  planned?: PlannedSession;
  /** Blocks after shortening (TR-06), if the user shortened the session. */
  shortened?: { minutes: number; blocks: Block[]; warmup: string[] };
}

export interface CheckIn {
  day: string;
  energy?: number;
  minutes?: number;
  pain?: boolean;
}

export interface SafetyEvent {
  id: string;
  type: 'red_flag_symptom' | 'crisis' | 'pain_report' | 'ed_signal' | 'unsafe_request';
  at: string;
  detail: string;
}

export interface PlanChangeRecord {
  id: string;
  kind: 'deload_next_week' | 'shorten_sessions' | 'add_volume';
  title: string;
  reason: string;
  ruleIds: string[];
  decision: 'accepted' | 'declined';
  weekStart: string;
  at: string;
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'coach';
  text: string;
  at: string;
  source?: 'template' | 'rules' | 'model' | 'fallback';
  safety?: string;
  actions?: { type: string; payload: Record<string, unknown>; label: string; decision?: 'confirmed' | 'dismissed' | 'failed' }[];
  cardIds?: string[];
  feedback?: 'up' | 'down' | 'wrong';
}

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner';

/** What the user logs for one food. The snapshot is computed once at save and never recomputed (EC-33). */
export interface MealItem {
  /** Also the client operation ID on the server. */
  id: string;
  food: FoodRef;
  name: string;
  quantity: number;
  unit: FoodUnit;
  oilLevel?: OilLevel;
  snapshot: LogSnapshot;
}

export interface MealLog {
  id: string;
  /** Logical day (04:00 cutoff), so a 00:30 snack belongs to the evening before. */
  day: string;
  at: string;
  mealType: MealType;
  source: 'search' | 'text_parse' | 'saved_meal';
  items: MealItem[];
  /** Set when the meal is edited, so backup sends it again. */
  updatedAt?: string;
}

/** A meal to re-log in two taps (F-14). Stores the choices, not the numbers: values are computed when logged. */
export interface SavedMeal {
  id: string;
  name: string;
  items: { food: FoodRef; name: string; quantity: number; unit: FoodUnit; oilLevel?: OilLevel }[];
  at: string;
}

export interface NutritionPrefs {
  /** Plate guidance hides every calorie number (FD-01). A non_numeric_only restriction forces it. */
  mode: 'numeric' | 'non_numeric';
  sex?: Sex;
  diet?: Diet;
  jain?: boolean;
  allergens: AllergenTag[];
  freeTextAllergies: string[];
}

export interface ProblemReport {
  /** Also the client operation ID on the server. */
  id: string;
  kind: 'wrong_food_data' | 'unsafe_advice' | 'bug' | 'account';
  text: string;
  at: string;
  context?: Record<string, string>;
}

/** A workout saved both on this phone and in the backup with different contents (S44). */
export interface SyncConflict {
  key: string;
  phone: { status: SessionLog['status']; sets: number };
  backup: { status: SessionLog['status']; opId: string; session: SessionLog; sets: SetLog[] };
}

export interface SyncState {
  /** Local key (for example `session:<key>`) to the client operation ID used on the server. */
  ids: Record<string, string>;
  consentAt?: string;
  readinessAt?: string;
  lastAt?: string;
  lastError?: string;
  /** Start time of the last fully successful push; sets and meals changed since then are sent next. */
  pushedFrom?: string;
  /** The backup account this phone's data belongs to. Set after the first restore; pushes need it. */
  linkedUserId?: string;
  conflicts: SyncConflict[];
  /** Server rows to delete on the next push, as `table:client_op_id`. */
  deleted: string[];
}

export interface PlanOptions {
  /** Monday of an accepted lighter week. */
  deloadWeekStart?: string;
  volumeBonus: number;
}

export interface OnboardingDraft {
  step: number;
  birthYear?: string;
  consentCore?: boolean;
  consentAi?: boolean;
  goal?: Goal;
  heightCm?: string;
  weightKg?: string;
  experience?: TrainingProfile['experience'];
  activity?: Profile['activity'];
  answers: Partial<Record<QuestionId, Answer>>;
  regions: Region[];
  clearance?: boolean;
  location?: TrainingProfile['location'];
  equipment: TrainingProfile['equipment'];
  days: number[];
  minutes: number;
  tone?: Profile['tone'];
  units: Profile['units'];
}

export interface AppState {
  schema: 1;
  hydrated: boolean;
  onboarded: boolean;
  draft: OnboardingDraft;
  profile?: Profile;
  consents?: Consents;
  readiness?: ReadinessState;
  restrictions: Restriction[];
  plan?: PlanState;
  sessions: Record<string, SessionLog>;
  sets: SetLog[];
  checkIns: Record<string, CheckIn>;
  safetyEvents: SafetyEvent[];
  planChanges: PlanChangeRecord[];
  planOptions: PlanOptions;
  coachMessages: CoachMessage[];
  reminders: ReminderPrefs;
  /** Which model words the coach's replies, when AI is on. Every model gets the same rules and checks. */
  coachModel: CoachModelId;
  meals: MealLog[];
  savedMeals: SavedMeal[];
  nutrition: NutritionPrefs;
  /** Set while signed in to backup. The session itself lives in the auth storage, not here. */
  account?: { userId: string; email: string };
  sync: SyncState;
  reports: ProblemReport[];
}

export const emptyDraft = (): OnboardingDraft => ({
  step: 0,
  answers: {},
  regions: [],
  equipment: [],
  days: [0, 2, 4],
  minutes: 30,
  units: 'metric',
});

export const initialState = (): AppState => ({
  schema: 1,
  hydrated: false,
  onboarded: false,
  draft: emptyDraft(),
  restrictions: [],
  sessions: {},
  sets: [],
  checkIns: {},
  safetyEvents: [],
  planChanges: [],
  planOptions: { volumeBonus: 0 },
  coachMessages: [],
  reminders: DEFAULT_REMINDERS,
  sync: { ids: {}, conflicts: [], deleted: [] },
  reports: [],
  coachModel: DEFAULT_COACH_MODEL,
  meals: [],
  savedMeals: [],
  nutrition: { mode: 'numeric', allergens: [], freeTextAllergies: [] },
});
