import type { Dispatch } from 'react';
import { newId, type Action } from '../store/store';
import type { AppState, SetLog, SyncConflict } from '../store/types';
import { supabase } from './backend';
import { applyBackup, buildPush, idKey, missingIdKeys, type BackupData } from './syncMap';

/**
 * Backup sync (plan/12 section 6). Every write is an idempotent upsert keyed by a client operation
 * ID; deletions travel as tombstones. Each table is its own step, so one bad row never blocks the
 * rest, and each cursor moves only when its step succeeded. A failure leaves the phone untouched.
 */

type AnyDispatch = Dispatch<Action>;
export interface PushResult {
  ok: boolean;
  errors: string[];
}

const PAGE = 1000;

/** Reads every row of a table the user owns, a page at a time in a stable order. */
async function selectAll<T>(table: string, columns: string, order: string, where?: Record<string, string>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = supabase!.from(table).select(columns);
    for (const [k, v] of Object.entries(where ?? {})) q = q.eq(k, v);
    const r = await q.order(order).range(from, from + PAGE - 1);
    if (r.error) throw new Error(`${table}: ${r.error.message}`);
    rows.push(...(r.data as T[]));
    if (r.data.length < PAGE) return rows;
  }
}

async function pushOnce(getState: () => AppState, dispatch: AnyDispatch): Promise<PushResult> {
  const first = getState();
  if (!supabase || !first.account) return { ok: false, errors: ['not signed in'] };
  if (first.sync.linkedUserId !== first.account.userId) return { ok: false, errors: ['not linked to this account yet'] };
  const userId = first.account.userId;
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const step = async (what: string, fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    try {
      const r = await fn();
      if (r.error) throw new Error(r.error.message);
      return true;
    } catch (e) {
      errors.push(`${what}: ${(e as Error).message}`);
      return false;
    }
  };

  // 1. Give new rows a stable operation ID and save it before anything is sent.
  const fresh = Object.fromEntries(missingIdKeys(first).map((k) => [k, newId()]));
  if (Object.keys(fresh).length) dispatch({ type: 'sync', patch: { ids: fresh } });
  const rows = buildPush({ ...first, sync: { ...first.sync, ids: { ...first.sync.ids, ...fresh } } }, userId);
  const cursor: { consentAt?: string; readinessAt?: string } = {};
  const processed: string[] = [];

  // 2. Deletions the user made on the phone (children first).
  for (const d of rows.deletes) {
    if (await step('deletions', () => supabase!.from(d.table).delete().eq('client_op_id', d.opId))) processed.push(d.raw);
  }

  // 3. Settings and append-only records.
  if (rows.profile) await step('profile', () => supabase!.from('profiles').upsert(rows.profile!, { onConflict: 'user_id' }));
  if (rows.consents.length && (await step('consent', () => supabase!.from('consent_records').upsert(rows.consents, { onConflict: 'user_id,client_op_id', ignoreDuplicates: true }))))
    cursor.consentAt = rows.cursor.consentAt;
  if (rows.readiness && (await step('safety answers', () => supabase!.from('readiness_assessments').upsert(rows.readiness!, { onConflict: 'user_id,client_op_id', ignoreDuplicates: true }))))
    cursor.readinessAt = rows.cursor.readinessAt;
  // Upsert the limits the phone has, then remove only limits the phone no longer has.
  if (rows.restrictions.length) await step('limits', () => supabase!.from('restrictions').upsert(rows.restrictions, { onConflict: 'user_id,code' }));
  if (!errors.some((e) => e.startsWith('limits'))) {
    await step('limits', () => {
      const q = supabase!.from('restrictions').delete().eq('user_id', userId);
      return rows.restrictionCodes.length ? q.not('code', 'in', `(${rows.restrictionCodes.map((c) => `"${c}"`).join(',')})`) : q;
    });
  }
  if (rows.safety.length) await step('safety events', () => supabase!.from('safety_events').upsert(rows.safety, { onConflict: 'id', ignoreDuplicates: true }));
  if (rows.preferences) await step('food settings', () => supabase!.from('preferences').upsert(rows.preferences!, { onConflict: 'user_id' }));
  if (rows.checkIns.length) await step('check-ins', () => supabase!.from('check_ins').upsert(rows.checkIns, { onConflict: 'user_id,day' }));
  if (rows.reports.length) await step('reports', () => supabase!.from('reports').upsert(rows.reports, { onConflict: 'user_id,client_op_id', ignoreDuplicates: true }));
  if (rows.savedMeals.length) await step('usual meals', () => supabase!.from('saved_meals').upsert(rows.savedMeals, { onConflict: 'user_id,client_op_id' }));
  if (rows.weights.length) await step('weigh-ins', () => supabase!.from('progress_entries').upsert(rows.weights, { onConflict: 'user_id,client_op_id' }));

  // 4. Workouts, then their new sets in one batch.
  let incrementalOk = true;
  if (rows.sessions.length) {
    let saved: { id: string; client_op_id: string }[] = [];
    const okSessions = await step('workouts', async () => {
      const r = await supabase!.from('workout_sessions').upsert(rows.sessions, { onConflict: 'user_id,client_op_id' }).select('id, client_op_id');
      saved = (r.data ?? []) as typeof saved;
      return r;
    });
    const byOp = new Map(saved.map((s) => [s.client_op_id, s.id]));
    const sets = Object.entries(rows.setsBySession).flatMap(([op, list]) => (byOp.has(op) ? list.map((x) => ({ ...x, session_id: byOp.get(op)! })) : []));
    const okSets = !sets.length || (await step('sets', () => supabase!.from('exercise_sets').upsert(sets, { onConflict: 'user_id,client_op_id', ignoreDuplicates: true })));
    incrementalOk &&= okSessions && okSets;
  }

  // 5. Changed meals, then their items in one batch.
  if (rows.meals.length) {
    let saved: { id: string; client_op_id: string }[] = [];
    const okMeals = await step('meals', async () => {
      const r = await supabase!.from('meal_logs').upsert(rows.meals, { onConflict: 'user_id,client_op_id' }).select('id, client_op_id');
      saved = (r.data ?? []) as typeof saved;
      return r;
    });
    const byOp = new Map(saved.map((m) => [m.client_op_id, m.id]));
    const items = Object.entries(rows.itemsByMeal).flatMap(([op, list]) => (byOp.has(op) ? list.map((x) => ({ ...x, meal_log_id: byOp.get(op)! })) : []));
    const okItems = !items.length || (await step('meal items', () => supabase!.from('meal_log_items').upsert(items, { onConflict: 'user_id,client_op_id', ignoreDuplicates: true })));
    incrementalOk &&= okMeals && okItems;
  }

  dispatch({
    type: 'sync',
    patch: {
      ...cursor,
      ...(incrementalOk ? { pushedFrom: startedAt } : {}),
      ...(errors.length ? { lastError: errors.join('; ') } : { lastAt: new Date().toISOString(), lastError: undefined }),
    },
    processed,
  });
  return { ok: errors.length === 0, errors };
}

/* One push at a time. A request during a push runs once more afterwards, with the latest state. */
let running: Promise<PushResult> | null = null;
let again = false;

export function requestPush(getState: () => AppState, dispatch: AnyDispatch): Promise<PushResult> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    let result: PushResult;
    do {
      again = false;
      result = await pushOnce(getState, dispatch);
    } while (again);
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Pull the whole backup (paged, so nothing past 1,000 rows is missed). */
export async function pullBackup(): Promise<BackupData> {
  const [sessions, sets, checkIns, meals, items, saved, restrictions, weights] = await Promise.all([
    selectAll<BackupData['sessions'][number]>('workout_sessions', 'id, client_op_id, plan_session_key, status, started_at, ended_at, feel', 'id'),
    selectAll<BackupData['sets'][number]>('exercise_sets', 'client_op_id, session_id, exercise_id, set_index, reps, duration_s, load_kg, effort_rir, logged_at', 'id'),
    selectAll<BackupData['checkIns'][number]>('check_ins', 'day, energy, minutes_available, pain, client_op_id', 'id'),
    selectAll<BackupData['meals'][number]>('meal_logs', 'id, client_op_id, eaten_at, day, meal_type, source', 'id'),
    selectAll<BackupData['items'][number]>('meal_log_items', 'meal_log_id, client_op_id, name, qty, unit, oil_level, nutrients_snapshot', 'id'),
    selectAll<BackupData['saved'][number]>('saved_meals', 'client_op_id, name, items, created_at', 'id'),
    selectAll<BackupData['restrictions'][number]>('restrictions', 'code, source, expires_at', 'id'),
    // Only weigh-ins: the same table can hold other measurements, which must never become kilograms.
    selectAll<BackupData['weights'][number]>('progress_entries', 'client_op_id, value, measured_at, tz', 'id', { metric: 'weight_kg' }),
  ]);
  const profile = await supabase!.from('profiles').select('nutrition_mode').maybeSingle();
  const preferences = await supabase!.from('preferences').select('diet_pattern, allergens, allergen_free_text').maybeSingle();
  if (profile.error) throw new Error(`profile: ${profile.error.message}`);
  if (preferences.error) throw new Error(`food settings: ${preferences.error.message}`);
  return { sessions, sets, checkIns, meals, items, saved, restrictions, weights, profile: profile.data, preferences: preferences.data };
}

/**
 * Pull the backup into the phone. The merge runs inside the reducer against the current state, so
 * anything logged while the pull was in flight is kept. With `link`, this phone becomes tied to
 * the signed-in account and pushes may start.
 */
export async function restore(
  getState: () => AppState,
  dispatch: AnyDispatch,
  importSets: (sets: SetLog[]) => Promise<void>,
  opts: { link?: boolean } = {},
): Promise<{ sessions: number; sets: number; checkIns: number; meals: number; conflicts: number }> {
  const before = getState();
  if (!supabase || !before.account) return { sessions: 0, sets: 0, checkIns: 0, meals: 0, conflicts: 0 };
  const data = await pullBackup();
  // If the account changed while the pull was in flight, this backup is not this account's.
  if (getState().account?.userId !== before.account.userId) throw new Error('the signed-in account changed; try again');
  const preview = applyBackup(before, data);
  const have = new Set(before.sets.map((s) => s.id));
  // Sets go to phone storage first (idempotent), then the reducer merges against the latest state.
  await importSets(preview.sets.filter((s) => !have.has(s.id)));
  dispatch({ type: 'restore', data, linkUserId: opts.link ? before.account.userId : undefined });
  return {
    sessions: Object.keys(preview.sessions).length - Object.keys(before.sessions).length,
    sets: preview.sets.length - before.sets.length,
    checkIns: Object.keys(preview.checkIns).length - Object.keys(before.checkIns).length,
    meals: preview.meals.length - before.meals.length,
    conflicts: preview.sync.conflicts.length - before.sync.conflicts.length,
  };
}

/** Settle a conflict. Keeping the phone deletes the backup's copy; keeping the backup replaces the phone's. */
export async function resolveConflict(
  getState: () => AppState,
  conflict: SyncConflict,
  keep: 'phone' | 'backup',
  dispatch: AnyDispatch,
  store: { importSets: (sets: SetLog[]) => Promise<void>; removeSet: (id: string) => Promise<void> },
): Promise<void> {
  const remaining = () => getState().sync.conflicts.filter((c) => !(c.key === conflict.key && c.backup.opId === conflict.backup.opId));
  if (keep === 'phone') {
    if (supabase) {
      const r = await supabase.from('workout_sessions').delete().eq('client_op_id', conflict.backup.opId);
      if (r.error) throw new Error(r.error.message);
    }
    dispatch({ type: 'sync', patch: { conflicts: remaining() } });
    return;
  }
  const state = getState();
  const phoneOp = state.sync.ids[idKey.session(conflict.key)];
  for (const s of state.sets.filter((x) => x.sessionKey === conflict.key)) await store.removeSet(s.id);
  await store.importSets(conflict.backup.sets);
  dispatch({ type: 'session', key: conflict.key, patch: conflict.backup.session });
  dispatch({ type: 'sync', patch: { conflicts: remaining(), ids: { [idKey.session(conflict.key)]: conflict.backup.opId } } });
  // The phone's own copy on the server goes too (its sets cascade with it).
  if (phoneOp) dispatch({ type: 'tombstone', keys: [`workout_sessions:${phoneOp}`] });
}
