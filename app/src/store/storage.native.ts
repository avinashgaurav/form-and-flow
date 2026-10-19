import * as SQLite from 'expo-sqlite';
import type { AppState, SetLog } from './types';

/**
 * Native storage: SQLite on the phone (ADR-02). App state as one row; sets as their own rows keyed by
 * the client operation ID so a double tap or a retried write never creates a duplicate.
 * Encryption (SQLCipher) needs a development build and is enabled before the beta.
 */

const db = SQLite.openDatabaseSync('formflow.db');
db.execSync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sets (
    id TEXT PRIMARY KEY NOT NULL,
    session_key TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    set_index INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    load_kg REAL NOT NULL,
    rir INTEGER,
    at TEXT NOT NULL
  );
`);

interface SetRow { id: string; session_key: string; exercise_id: string; set_index: number; reps: number; load_kg: number; rir: number | null; at: string }

export async function loadAll(): Promise<{ state: Partial<AppState> | null; sets: SetLog[] }> {
  try {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', 'state');
    const rows = await db.getAllAsync<SetRow>('SELECT * FROM sets ORDER BY at');
    return {
      state: row ? JSON.parse(row.value) : null,
      sets: rows.map((r) => ({ id: r.id, sessionKey: r.session_key, exerciseId: r.exercise_id, setIndex: r.set_index, reps: r.reps, loadKg: r.load_kg, rir: r.rir ?? undefined, at: r.at })),
    };
  } catch {
    return { state: null, sets: [] };
  }
}

export async function saveState(state: Omit<AppState, 'sets' | 'hydrated'>): Promise<void> {
  try {
    await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', 'state', JSON.stringify(state));
  } catch {
    // The next change saves again; sets are written separately and are never lost here.
  }
}

export async function insertSet(s: SetLog): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO sets (id, session_key, exercise_id, set_index, reps, load_kg, rir, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    s.id, s.sessionKey, s.exerciseId, s.setIndex, s.reps, s.loadKg, s.rir ?? null, s.at,
  );
}

export async function deleteSet(id: string): Promise<void> {
  await db.runAsync('DELETE FROM sets WHERE id = ?', id);
}

export async function clearAll(): Promise<void> {
  await db.execAsync('DELETE FROM kv; DELETE FROM sets;');
}
