import { getExercise, isHoldExercise, logicalDay, QUESTIONNAIRE_VERSION, type AllergenTag, type LogSnapshot, type Restriction, type WeightEntry } from '@ff/engines';
import type { AppState, MealLog, NutritionPrefs, SafetyEvent, SavedMeal, SessionLog, SetLog, SyncConflict } from '../store/types';

/**
 * Pure mapping between the phone's state and the backup tables (plan/12 section 6). No network here,
 * so it can be tested in Node. The phone is the source of truth; the backup mirrors it.
 *
 * Deletions travel as tombstones (`table:client_op_id` in sync.deleted), never as "delete whatever
 * the phone does not have", so a partial restore can never wipe backup history.
 */

type ConsentPurpose = 'core' | 'ai_processing';

export const idKey = {
  session: (key: string) => `session:${key}`,
  checkIn: (day: string) => `checkin:${day}`,
  consent: (purpose: ConsentPurpose, at: string) => `consent:${purpose}:${at}`,
  readiness: (at: string) => `readiness:${at}`,
};

/** Rows that need a stable client operation ID before their first push. */
export function missingIdKeys(state: AppState): string[] {
  const keys = [
    ...Object.values(state.sessions).filter((s) => s.status !== 'planned').map((s) => idKey.session(s.key)),
    ...Object.keys(state.checkIns).map(idKey.checkIn),
    ...(state.consents ? (['core', 'ai_processing'] as const).map((p) => idKey.consent(p, state.consents!.at)) : []),
    ...(state.readiness ? [idKey.readiness(state.readiness.at)] : []),
  ];
  return keys.filter((k) => !state.sync.ids[k]);
}

const SEVERITY: Record<SafetyEvent['type'], 'critical' | 'high' | 'medium'> = {
  crisis: 'critical',
  red_flag_symptom: 'critical',
  pain_report: 'high',
  ed_signal: 'high',
  unsafe_request: 'medium',
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/** Rows logged this long before the last successful push are sent again, to absorb clock skew. */
const OVERLAP_MS = 3_600_000;

export function setRow(userId: string, s: SetLog) {
  const hold = isHoldExercise(s.exerciseId);
  return {
    user_id: userId,
    exercise_id: s.exerciseId,
    set_index: s.setIndex,
    reps: hold ? null : clamp(s.reps, 0, 100),
    duration_s: hold ? clamp(s.reps, 1, 7200) : null,
    load_kg: getExercise(s.exerciseId)?.loaded ? Math.min(500, Math.max(0, s.loadKg)) : null,
    effort_rir: s.rir === undefined ? null : clamp(s.rir, 0, 10),
    status: 'done' as const,
    logged_at: s.at,
    client_op_id: s.id,
  };
}

/** Tables the phone may delete from, children before parents. */
const DELETABLE_TABLES = ['exercise_sets', 'meal_log_items', 'workout_sessions', 'meal_logs', 'saved_meals', 'progress_entries'] as const;

export type Tombstone = { table: (typeof DELETABLE_TABLES)[number]; opId: string; raw: string };

export function tombstones(state: AppState): Tombstone[] {
  return state.sync.deleted
    .map((raw) => {
      const i = raw.indexOf(':');
      return { table: raw.slice(0, i) as Tombstone['table'], opId: raw.slice(i + 1), raw };
    })
    .filter((d) => (DELETABLE_TABLES as readonly string[]).includes(d.table) && /^[0-9a-f-]{8,64}$/i.test(d.opId))
    .sort((a, b) => DELETABLE_TABLES.indexOf(a.table) - DELETABLE_TABLES.indexOf(b.table));
}

const isTombstoned = (state: AppState, table: string, op: string) => state.sync.deleted.includes(`${table}:${op}`);

function dietPattern(n: NutritionPrefs): string | null {
  if (n.jain) return 'jain';
  return n.diet === 'egg' ? 'eggetarian' : n.diet ?? null;
}

export function mealRows(userId: string, tz: string, m: MealLog) {
  return {
    meal: { user_id: userId, client_op_id: m.id, eaten_at: m.at, day: m.day, tz, meal_type: m.mealType, source: m.source },
    items: m.items
      .filter((i) => i.snapshot.grams && i.snapshot.grams.mid > 0 && i.quantity > 0)
      .map((i) => ({
        user_id: userId,
        client_op_id: i.id,
        food_id: `${i.food.kind}:${i.food.id}`,
        name: i.name.slice(0, 120),
        qty: Math.min(5000, i.quantity),
        unit: i.unit,
        grams: Math.min(5000, Math.max(0.1, Math.round(i.snapshot.grams!.mid * 10) / 10)),
        oil_level: i.oilLevel ?? null,
        nutrients_snapshot: i.snapshot,
      })),
  };
}

/** Only one workout may be in progress on the server; any older one is sent as partial. */
function serverStatus(state: AppState, s: SessionLog): SessionLog['status'] {
  if (s.status !== 'in_progress') return s.status;
  const newest = Object.values(state.sessions)
    .filter((x) => x.status === 'in_progress')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  return newest?.key === s.key ? 'in_progress' : 'partial';
}

export interface PushRows {
  profile: Record<string, unknown> | null;
  consents: Record<string, unknown>[];
  readiness: Record<string, unknown> | null;
  restrictions: Record<string, unknown>[];
  restrictionCodes: string[];
  safety: Record<string, unknown>[];
  sessions: Record<string, unknown>[];
  /** Session client operation ID to that session's new set rows (without session_id yet). */
  setsBySession: Record<string, ReturnType<typeof setRow>[]>;
  checkIns: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  preferences: Record<string, unknown> | null;
  meals: Record<string, unknown>[];
  /** Meal client operation ID to that meal's item rows (without meal_log_id yet). */
  itemsByMeal: Record<string, ReturnType<typeof mealRows>['items']>;
  savedMeals: Record<string, unknown>[];
  weights: Record<string, unknown>[];
  deletes: Tombstone[];
  cursor: { consentAt?: string; readinessAt?: string };
}

/**
 * What to send. Append-only tables (consent, readiness) send only what is newer than their cursor;
 * sets and meals send only what changed since the last successful push (plus an overlap). Small
 * tables are sent whole; every write is an idempotent upsert.
 */
export function buildPush(state: AppState, userId: string): PushRows {
  const tz = state.profile?.timezone ?? 'Asia/Kolkata';
  const since = state.sync.pushedFrom ? new Date(Date.parse(state.sync.pushedFrom) - OVERLAP_MS).toISOString() : '';
  const c = state.consents;
  const consentOp = (p: ConsentPurpose) => (c ? state.sync.ids[idKey.consent(p, c.at)] : undefined);
  const consentNew = !!c && (!state.sync.consentAt || c.at > state.sync.consentAt) && !!consentOp('core') && !!consentOp('ai_processing');
  const r = state.readiness;
  const readinessOp = r ? state.sync.ids[idKey.readiness(r.at)] : undefined;
  const readinessNew = !!r && (!state.sync.readinessAt || r.at > state.sync.readinessAt) && !!readinessOp;

  // The in-progress workout goes last, so an older one is demoted in the same upsert before the
  // new one claims the server's single in-progress slot.
  const sessions = Object.values(state.sessions)
    .filter((s) => s.status !== 'planned' && state.sync.ids[idKey.session(s.key)])
    .sort((a, b) => Number(serverStatus(state, a) === 'in_progress') - Number(serverStatus(state, b) === 'in_progress'));
  const setsBySession: PushRows['setsBySession'] = {};
  for (const s of sessions) {
    const op = state.sync.ids[idKey.session(s.key)]!;
    const fresh = state.sets.filter((x) => x.sessionKey === s.key && x.setIndex >= 1 && x.setIndex <= 20 && x.at >= since);
    if (fresh.length) setsBySession[op] = fresh.map((x) => setRow(userId, x));
  }
  const meals = state.meals.filter((m) => (m.updatedAt ?? m.at) >= since && !isTombstoned(state, 'meal_logs', m.id));

  return {
    profile: state.profile
      ? {
          user_id: userId,
          birth_year: state.profile.birthYear,
          timezone: tz,
          units: state.profile.units,
          coach_tone: state.profile.tone,
          nutrition_mode: state.nutrition.mode,
          updated_at: new Date().toISOString(),
        }
      : null,
    consents: consentNew
      ? (['core', 'ai_processing'] as const).map((purpose) => ({
          user_id: userId,
          purpose,
          notice_version: c!.version,
          granted: purpose === 'core' ? c!.core : c!.aiProcessing,
          // The database stamps `at`; the phone's time is kept for reference only.
          client_at: c!.at,
          client_op_id: consentOp(purpose),
        }))
      : [],
    readiness: readinessNew
      ? {
          user_id: userId,
          questionnaire_version: QUESTIONNAIRE_VERSION,
          answers: { ...r!.answers, regions: r!.regions },
          disposition: r!.result.disposition,
          created_at: r!.at,
          client_op_id: readinessOp,
        }
      : null,
    restrictions: state.restrictions.map((x) => ({ user_id: userId, code: x.code, source: x.source, expires_at: x.expiresAt ?? null })),
    restrictionCodes: state.restrictions.map((x) => x.code),
    safety: state.safetyEvents.map((e) => ({ id: e.id, user_id: userId, type: e.type, severity: SEVERITY[e.type], handled_by: 'app', context_ref: e.detail.slice(0, 200), created_at: e.at })),
    sessions: sessions.map((s) => ({
      user_id: userId,
      client_op_id: state.sync.ids[idKey.session(s.key)],
      plan_session_key: s.key,
      status: serverStatus(state, s),
      started_at: s.startedAt,
      ended_at: s.endedAt ?? null,
      tz,
      feel: s.feel ?? null,
    })),
    setsBySession,
    checkIns: Object.values(state.checkIns)
      .filter((x) => state.sync.ids[idKey.checkIn(x.day)])
      .map((x) => ({
        user_id: userId,
        day: x.day,
        energy: x.energy ?? null,
        minutes_available: x.minutes ?? null,
        pain: !!x.pain,
        client_op_id: state.sync.ids[idKey.checkIn(x.day)],
      })),
    reports: state.reports.map((x) => ({ user_id: userId, kind: x.kind, text: x.text, context: x.context ?? null, app_version: '0.1.0', client_op_id: x.id, created_at: x.at })),
    preferences: {
      user_id: userId,
      diet_pattern: dietPattern(state.nutrition),
      allergens: state.nutrition.allergens,
      allergen_free_text: state.nutrition.freeTextAllergies,
      updated_at: new Date().toISOString(),
    },
    meals: meals.map((m) => mealRows(userId, tz, m).meal),
    itemsByMeal: Object.fromEntries(meals.map((m) => [m.id, mealRows(userId, tz, m).items])),
    savedMeals: state.savedMeals
      .filter((m) => !isTombstoned(state, 'saved_meals', m.id))
      .map((m) => ({ user_id: userId, client_op_id: m.id, name: m.name, items: m.items, created_at: m.at, updated_at: m.at })),
    weights: state.weights
      .filter((w) => !isTombstoned(state, 'progress_entries', w.id))
      .map((w) => ({ user_id: userId, metric: 'weight_kg', value: w.kg, measured_at: w.at, tz, source: 'manual', client_op_id: w.id, updated_at: w.updatedAt ?? w.at })),
    deletes: tombstones(state),
    cursor: { consentAt: consentNew ? c!.at : state.sync.consentAt, readinessAt: readinessNew ? r!.at : state.sync.readinessAt },
  };
}

/* ---------- Restore: workouts ---------- */

export interface ServerSession {
  id: string;
  client_op_id: string;
  plan_session_key: string | null;
  status: string;
  started_at: string;
  ended_at: string | null;
  feel: SessionLog['feel'] | null;
}
export interface ServerSet {
  client_op_id: string;
  session_id: string;
  exercise_id: string;
  set_index: number;
  reps: number | null;
  duration_s: number | null;
  load_kg: number | null;
  effort_rir: number | null;
  logged_at: string;
}
export interface ServerCheckIn {
  day: string;
  energy: number | null;
  minutes_available: number | null;
  pain: boolean;
  client_op_id: string;
}

const STATUSES: SessionLog['status'][] = ['in_progress', 'completed', 'partial'];

function toLocal(s: ServerSession, key: string): SessionLog {
  return {
    key,
    status: STATUSES.includes(s.status as SessionLog['status']) ? (s.status as SessionLog['status']) : 'partial',
    startedAt: s.started_at,
    endedAt: s.ended_at ?? undefined,
    feel: s.feel ?? undefined,
    swaps: {},
  };
}

function setToLocal(x: ServerSet, key: string): SetLog {
  return {
    id: x.client_op_id,
    sessionKey: key,
    exerciseId: x.exercise_id,
    setIndex: x.set_index,
    reps: x.reps ?? x.duration_s ?? 0,
    loadKg: x.load_kg === null ? 0 : Number(x.load_kg),
    rir: x.effort_rir ?? undefined,
    at: x.logged_at,
  };
}

export interface MergeResult {
  sessions: Record<string, SessionLog>;
  newSets: SetLog[];
  checkIns: AppState['checkIns'];
  ids: Record<string, string>;
  conflicts: SyncConflict[];
  added: { sessions: number; sets: number; checkIns: number };
}

/**
 * Merge a backup into the phone without losing anything. Workouts only in the backup are added;
 * the same workout on both sides gains any missing sets; a different workout under the same plan
 * day becomes a conflict for the user to settle (S44). For check-ins the phone wins. Anything the
 * phone has deleted (tombstoned) is never brought back.
 */
export function mergeBackup(state: AppState, data: { sessions: ServerSession[]; sets: ServerSet[]; checkIns: ServerCheckIn[] }): MergeResult {
  const sessions = { ...state.sessions };
  const ids = { ...state.sync.ids };
  const haveSet = new Set(state.sets.map((s) => s.id));
  const newSets: SetLog[] = [];
  const conflicts: SyncConflict[] = [];
  const added = { sessions: 0, sets: 0, checkIns: 0 };
  const take = (x: SetLog) => {
    if (haveSet.has(x.id) || isTombstoned(state, 'exercise_sets', x.id)) return;
    haveSet.add(x.id);
    newSets.push(x);
    added.sets++;
  };

  for (const s of data.sessions) {
    if (isTombstoned(state, 'workout_sessions', s.client_op_id)) continue;
    const key = s.plan_session_key ?? `restored-${s.client_op_id}`;
    const serverSets = data.sets.filter((x) => x.session_id === s.id).map((x) => setToLocal(x, key));
    const local = sessions[key];
    const localOp = ids[idKey.session(key)];
    if (!local || local.status === 'planned') {
      sessions[key] = toLocal(s, key);
      ids[idKey.session(key)] = s.client_op_id;
      added.sessions++;
      serverSets.forEach(take);
    } else if (localOp === s.client_op_id) {
      serverSets.forEach(take);
    } else {
      conflicts.push({
        key,
        phone: { status: local.status, sets: state.sets.filter((x) => x.sessionKey === key).length },
        backup: { status: toLocal(s, key).status, opId: s.client_op_id, session: toLocal(s, key), sets: serverSets },
      });
    }
  }

  const checkIns = { ...state.checkIns };
  for (const c of data.checkIns) {
    if (checkIns[c.day]) continue;
    checkIns[c.day] = { day: c.day, energy: c.energy ?? undefined, minutes: c.minutes_available ?? undefined, pain: c.pain };
    ids[idKey.checkIn(c.day)] = c.client_op_id;
    added.checkIns++;
  }

  const existing = new Set(state.sync.conflicts.map((c) => `${c.key}|${c.backup.opId}`));
  return {
    sessions,
    newSets,
    checkIns,
    ids,
    conflicts: [...state.sync.conflicts, ...conflicts.filter((c) => !existing.has(`${c.key}|${c.backup.opId}`))],
    added,
  };
}

/* ---------- Restore: food ---------- */

export interface ServerMeal {
  id: string;
  client_op_id: string;
  eaten_at: string;
  day: string;
  meal_type: MealLog['mealType'];
  source: MealLog['source'] | 'recipe';
}
export interface ServerMealItem {
  meal_log_id: string;
  client_op_id: string;
  name: string;
  qty: number;
  unit: string;
  oil_level: string | null;
  nutrients_snapshot: LogSnapshot;
}
export interface ServerSavedMeal {
  client_op_id: string;
  name: string;
  items: SavedMeal['items'];
  created_at: string;
}

/** Meals and usual meals only in the backup are added; anything on the phone or deleted there is left alone. */
export function mergeFood(state: AppState, data: { meals: ServerMeal[]; items: ServerMealItem[]; saved: ServerSavedMeal[] }) {
  const have = new Set(state.meals.map((m) => m.id));
  const meals: MealLog[] = [];
  for (const m of data.meals) {
    if (have.has(m.client_op_id) || isTombstoned(state, 'meal_logs', m.client_op_id)) continue;
    const items = data.items
      .filter((i) => i.meal_log_id === m.id && !isTombstoned(state, 'meal_log_items', i.client_op_id))
      .map((i) => ({
        id: i.client_op_id,
        food: i.nutrients_snapshot.food,
        name: i.name,
        quantity: Number(i.qty),
        unit: i.nutrients_snapshot.unit,
        oilLevel: i.nutrients_snapshot.oilLevel ?? undefined,
        snapshot: i.nutrients_snapshot,
      }));
    meals.push({ id: m.client_op_id, day: m.day, at: m.eaten_at, mealType: m.meal_type, source: m.source === 'recipe' ? 'search' : m.source, items });
  }
  const haveSaved = new Set(state.savedMeals.map((m) => m.id));
  const saved: SavedMeal[] = data.saved
    .filter((x) => !haveSaved.has(x.client_op_id) && !isTombstoned(state, 'saved_meals', x.client_op_id))
    .map((x) => ({ id: x.client_op_id, name: x.name, items: x.items, at: x.created_at }));
  return { meals: [...state.meals, ...meals], savedMeals: [...state.savedMeals, ...saved], added: { meals: meals.length, savedMeals: saved.length } };
}

/* ---------- Restore: settings ---------- */

export interface ServerProfile {
  nutrition_mode: 'numeric' | 'non_numeric' | null;
}
export interface ServerPreferences {
  diet_pattern: string | null;
  allergens: string[];
  allergen_free_text: string[];
}
export interface ServerRestriction {
  code: Restriction['code'];
  source: Restriction['source'];
  expires_at: string | null;
}

/**
 * Safety-relevant settings merge in the safe direction: limits and allergies are unions (a
 * permanent limit beats a temporary one, the later expiry wins), and plate guidance wins over
 * numbers. Everything else stays as the phone has it.
 */
export function mergeSettings(
  state: AppState,
  data: { profile: ServerProfile | null; preferences: ServerPreferences | null; restrictions: ServerRestriction[] },
): { restrictions: Restriction[]; nutrition: NutritionPrefs } {
  const byCode = new Map(state.restrictions.map((r) => [r.code, r]));
  for (const s of data.restrictions) {
    const local = byCode.get(s.code);
    const incoming: Restriction = { code: s.code, source: s.source, ...(s.expires_at ? { expiresAt: s.expires_at.slice(0, 10) } : {}) };
    if (!local) byCode.set(s.code, incoming);
    else if (local.expiresAt && (!incoming.expiresAt || incoming.expiresAt > local.expiresAt)) byCode.set(s.code, incoming);
  }
  const n = state.nutrition;
  const p = data.preferences;
  const serverDiet: NutritionPrefs['diet'] =
    p?.diet_pattern === 'eggetarian' ? 'egg' : p?.diet_pattern === 'jain' ? 'veg' : p?.diet_pattern === 'veg' || p?.diet_pattern === 'vegan' || p?.diet_pattern === 'non_veg' ? p.diet_pattern : undefined;
  const nutrition: NutritionPrefs = {
    ...n,
    mode: n.mode === 'non_numeric' || data.profile?.nutrition_mode === 'non_numeric' ? 'non_numeric' : 'numeric',
    diet: n.diet ?? serverDiet,
    jain: n.jain || p?.diet_pattern === 'jain' ? true : undefined,
    allergens: [...new Set([...n.allergens, ...((p?.allergens ?? []) as AllergenTag[])])],
    freeTextAllergies: [...new Set([...n.freeTextAllergies, ...(p?.allergen_free_text ?? [])])],
  };
  return { restrictions: [...byCode.values()], nutrition };
}

export interface ServerWeight {
  client_op_id: string;
  value: number;
  measured_at: string;
  /** The zone the weigh-in was made in; its logical day is computed there. */
  tz?: string;
  updated_at?: string;
}

/**
 * Merge weigh-ins from the backup. New ones are added; for one on both sides the newest edit wins;
 * anything this phone deleted stays gone.
 */
export function mergeWeights(state: AppState, rows: ServerWeight[]): WeightEntry[] {
  const tz = state.profile?.timezone ?? 'Asia/Kolkata';
  const edited = (w: { updatedAt?: string; at: string }) => Date.parse(w.updatedAt ?? w.at);
  const byId = new Map(state.weights.map((w) => [w.id, w]));
  for (const r of rows) {
    if (isTombstoned(state, 'progress_entries', r.client_op_id)) continue;
    const at = new Date(r.measured_at);
    const incoming: WeightEntry = {
      id: r.client_op_id,
      kg: Number(r.value),
      at: at.toISOString(),
      day: logicalDay(at, r.tz ?? tz),
      updatedAt: new Date(r.updated_at ?? r.measured_at).toISOString(),
    };
    const local = byId.get(r.client_op_id);
    if (!local || edited(incoming) > edited(local)) byId.set(r.client_op_id, local ? { ...local, kg: incoming.kg, updatedAt: incoming.updatedAt } : incoming);
  }
  return [...byId.values()];
}

/** Everything a restore pulls, in one value the store's reducer can merge against its current state. */
export interface BackupData {
  weights: ServerWeight[];
  sessions: ServerSession[];
  sets: ServerSet[];
  checkIns: ServerCheckIn[];
  meals: ServerMeal[];
  items: ServerMealItem[];
  saved: ServerSavedMeal[];
  profile: ServerProfile | null;
  preferences: ServerPreferences | null;
  restrictions: ServerRestriction[];
}

/** Apply a whole backup to a state. Used inside the reducer so nothing logged meanwhile is lost. */
export function applyBackup(state: AppState, data: BackupData, linkUserId?: string): AppState {
  const w = mergeBackup(state, data);
  const f = mergeFood(state, data);
  const st = mergeSettings(state, data);
  const have = new Set(state.sets.map((s) => s.id));
  return {
    ...state,
    sessions: w.sessions,
    checkIns: w.checkIns,
    sets: [...state.sets, ...w.newSets.filter((s) => !have.has(s.id))],
    meals: f.meals,
    savedMeals: f.savedMeals,
    restrictions: st.restrictions,
    nutrition: st.nutrition,
    weights: mergeWeights(state, data.weights ?? []),
    sync: { ...state.sync, ids: w.ids, conflicts: w.conflicts, ...(linkUserId ? { linkedUserId: linkUserId } : {}) },
  };
}
