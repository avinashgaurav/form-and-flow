import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import * as Crypto from 'expo-crypto';
import type { Restriction } from '@ff/engines';
import { applyBackup, mergeWeights, type BackupData, type ServerWeight } from '../lib/syncMap';
import { clearAll, deleteSet, insertSet, loadAll, saveState } from './storage';
import { initialState, type AppState, type SafetyEvent, type SessionLog, type SetLog, type SyncState } from './types';

export type Action =
  | { type: 'hydrate'; state: Partial<AppState> | null; sets: SetLog[] }
  | { type: 'patch'; patch: Partial<AppState> }
  | { type: 'draft'; patch: Partial<AppState['draft']> }
  | { type: 'session'; key: string; patch: Partial<SessionLog> }
  | { type: 'set:add'; set: SetLog }
  | { type: 'set:remove'; id: string }
  | { type: 'restriction:add'; restriction: Restriction }
  | { type: 'restriction:remove'; code: Restriction['code'] }
  | { type: 'safety'; event: SafetyEvent }
  /** Merges into sync state, so a push finishing late never drops IDs or deletions added meanwhile. */
  | { type: 'sync'; patch: Partial<Omit<SyncState, 'deleted'>>; processed?: string[] }
  /** Record server rows to delete on the next push (`table:client_op_id`). */
  | { type: 'tombstone'; keys: string[] }
  /** Merge weigh-ins pulled after a push, so edits from another phone arrive here too. */
  | { type: 'weights:merge'; rows: ServerWeight[] }
  /** Merge a pulled backup into the current state (never a stale snapshot). */
  | { type: 'restore'; data: BackupData; linkUserId?: string }
  | { type: 'reset' };

function reducer(state: AppState, a: Action): AppState {
  switch (a.type) {
    case 'hydrate': {
      const base = initialState();
      const merged = {
        ...base,
        ...(a.state ?? {}),
        draft: { ...base.draft, ...(a.state?.draft ?? {}) },
        sync: { ...base.sync, ...(a.state?.sync ?? {}) },
        nutrition: { ...base.nutrition, ...(a.state?.nutrition ?? {}) },
        tracking: { ...base.tracking, ...(a.state?.tracking ?? {}) },
        reminders: { ...base.reminders, ...(a.state?.reminders ?? {}) },
      };
      // Coach conversations are kept 90 days by default (plan/15 section 2).
      const cutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
      merged.coachMessages = (merged.coachMessages ?? []).filter((m) => m.at >= cutoff);
      return { ...merged, sets: a.sets, hydrated: true };
    }
    case 'patch':
      return { ...state, ...a.patch };
    case 'draft':
      return { ...state, draft: { ...state.draft, ...a.patch } };
    case 'session': {
      const prev = state.sessions[a.key] ?? { key: a.key, status: 'planned' as const, startedAt: new Date().toISOString(), swaps: {} };
      const sessions = { ...state.sessions, [a.key]: { ...prev, ...a.patch } };
      // Only one workout can be in progress: starting one ends any other as partial.
      if (a.patch.status === 'in_progress') {
        for (const s of Object.values(sessions)) {
          if (s.key !== a.key && s.status === 'in_progress') sessions[s.key] = { ...s, status: 'partial', endedAt: s.endedAt ?? new Date().toISOString() };
        }
      }
      return { ...state, sessions };
    }
    case 'set:add':
      return state.sets.some((s) => s.id === a.set.id) ? state : { ...state, sets: [...state.sets, a.set] };
    case 'set:remove':
      return {
        ...state,
        sets: state.sets.filter((s) => s.id !== a.id),
        // Once this phone has ever been linked to a backup, the removal travels as a tombstone so the
        // server copy goes too, even if it happens while signed out.
        sync: state.sync.linkedUserId ? { ...state.sync, deleted: [...state.sync.deleted, `exercise_sets:${a.id}`] } : state.sync,
      };
    case 'restriction:add': {
      // Never shorten an existing limit: a permanent one beats a temporary one, and the later expiry wins.
      const existing = state.restrictions.find((r) => r.code === a.restriction.code);
      if (existing && (!existing.expiresAt || (a.restriction.expiresAt && existing.expiresAt >= a.restriction.expiresAt))) return state;
      return { ...state, restrictions: [...state.restrictions.filter((r) => r.code !== a.restriction.code), a.restriction] };
    }
    case 'restriction:remove':
      return { ...state, restrictions: state.restrictions.filter((r) => r.code !== a.code) };
    case 'safety':
      return { ...state, safetyEvents: [...state.safetyEvents, a.event] };
    case 'tombstone':
      return { ...state, sync: { ...state.sync, deleted: [...state.sync.deleted, ...a.keys.filter((k) => !state.sync.deleted.includes(k))] } };
    case 'weights:merge':
      return { ...state, weights: mergeWeights(state, a.rows) };
    case 'restore':
      return applyBackup(state, a.data, a.linkUserId);
    case 'sync': {
      const done = new Set(a.processed ?? []);
      return {
        ...state,
        sync: { ...state.sync, ...a.patch, ids: { ...state.sync.ids, ...(a.patch.ids ?? {}) }, deleted: state.sync.deleted.filter((d) => !done.has(d)) },
      };
    }
    case 'reset':
      return { ...initialState(), hydrated: true };
  }
}

interface Store {
  state: AppState;
  dispatch: (a: Action) => void;
  /** Writes the set to the phone first, then updates state. Safe to call twice with the same ID. */
  logSet: (set: Omit<SetLog, 'id' | 'at'> & { id?: string }) => Promise<SetLog>;
  removeSet: (id: string) => Promise<void>;
  resetAll: () => Promise<void>;
  /** Writes restored sets exactly as they are (backup restore). Existing IDs are left alone. */
  importSets: (sets: SetLog[]) => Promise<void>;
  /** The state as of the last render, for async work that outlives a render. */
  getState: () => AppState;
}

const Ctx = createContext<Store | null>(null);

export const newId = () => Crypto.randomUUID();

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const getState = useCallback(() => stateRef.current, []);

  useEffect(() => {
    loadAll().then(({ state: saved, sets }) => dispatch({ type: 'hydrate', state: saved, sets }));
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const { sets: _sets, hydrated: _h, ...rest } = state;
      void saveState(rest);
    }, 250);
  }, [state]);

  const logSet = useCallback<Store['logSet']>(async (input) => {
    const set: SetLog = { ...input, id: input.id ?? newId(), at: new Date().toISOString() };
    await insertSet(set);
    dispatch({ type: 'set:add', set });
    return set;
  }, []);

  const removeSet = useCallback(async (id: string) => {
    await deleteSet(id);
    dispatch({ type: 'set:remove', id });
  }, []);

  const importSets = useCallback(async (sets: SetLog[]) => {
    for (const set of sets) {
      await insertSet(set);
      dispatch({ type: 'set:add', set });
    }
  }, []);

  const resetAll = useCallback(async () => {
    await clearAll();
    dispatch({ type: 'reset' });
  }, []);

  const value = useMemo(() => ({ state, dispatch, logSet, removeSet, resetAll, importSets, getState }), [state, logSet, removeSet, resetAll, importSets, getState]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}
