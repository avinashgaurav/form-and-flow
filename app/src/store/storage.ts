import type { AppState, SetLog } from './types';

/**
 * Web storage (used by the web preview). The native build uses storage.native.ts (SQLite).
 * Every call is wrapped: private windows and blocked storage must never crash the app.
 */

const STATE_KEY = 'ff.state.v1';
const SETS_KEY = 'ff.sets.v1';

function ls(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export async function loadAll(): Promise<{ state: Partial<AppState> | null; sets: SetLog[] }> {
  const store = ls();
  if (!store) return { state: null, sets: [] };
  try {
    const raw = store.getItem(STATE_KEY);
    const sets = store.getItem(SETS_KEY);
    return { state: raw ? JSON.parse(raw) : null, sets: sets ? JSON.parse(sets) : [] };
  } catch {
    return { state: null, sets: [] };
  }
}

export async function saveState(state: Omit<AppState, 'sets' | 'hydrated'>): Promise<void> {
  try {
    ls()?.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the in-memory state is still correct for this session.
  }
}

/** Idempotent: inserting the same set ID twice keeps one row. */
export async function insertSet(set: SetLog): Promise<void> {
  const store = ls();
  if (!store) return;
  try {
    const cur: SetLog[] = JSON.parse(store.getItem(SETS_KEY) ?? '[]');
    if (!cur.some((x) => x.id === set.id)) cur.push(set);
    store.setItem(SETS_KEY, JSON.stringify(cur));
  } catch {
    // see saveState
  }
}

export async function deleteSet(id: string): Promise<void> {
  const store = ls();
  if (!store) return;
  try {
    const cur: SetLog[] = JSON.parse(store.getItem(SETS_KEY) ?? '[]');
    store.setItem(SETS_KEY, JSON.stringify(cur.filter((x) => x.id !== id)));
  } catch {
    // see saveState
  }
}

export async function clearAll(): Promise<void> {
  try {
    ls()?.removeItem(STATE_KEY);
    ls()?.removeItem(SETS_KEY);
  } catch {
    // nothing else to do
  }
}
