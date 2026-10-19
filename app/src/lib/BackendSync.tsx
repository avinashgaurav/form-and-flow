import type { CoachModelId, ModelCall, ModelOutput } from '@ff/engines';
import { useEffect, useRef } from 'react';
import { useStore } from '../store/store';
import { callFunction, supabase } from './backend';
import { setRemoteModel } from './coach';
import { requestPush, restore } from './sync';

/** The coach's model call goes through our server only; the phone still validates every reply. */
const remoteCoach =
  (model: CoachModelId): ModelCall =>
  async (req) => {
    const { data, error } = await callFunction<{ output: ModelOutput }>('coach', {
      message: req.user,
      tone: req.tone,
      facts: req.facts,
      retry: req.retry,
      model,
    });
    if (error || !data) throw new Error(error?.code ?? 'NO_REPLY');
    return data.output;
  };

export const OTHER_ACCOUNT = 'This phone’s data belongs to a different backup account. Sign out, or delete this phone’s data in Settings first.';

/**
 * Keeps the sign-in state, the coach's server connection and the backup in step with the store.
 * After a sign-in it first pulls the backup and merges it (so a new phone never overwrites the
 * backup with empty settings), and only then starts pushing. Renders nothing; does nothing at all
 * when no backend is configured.
 */
export function BackendSync() {
  const { state, dispatch, getState, importSets } = useStore();
  const linking = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase || !state.hydrated) return;
    const apply = (user: { id: string; email?: string } | undefined) => {
      const next = user ? { userId: user.id, email: user.email ?? '' } : undefined;
      if (getState().account?.userId !== next?.userId) dispatch({ type: 'patch', patch: { account: next } });
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session?.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user));
    return () => data.subscription.unsubscribe();
  }, [state.hydrated, dispatch, getState]);

  const aiOn = !!state.account && !!state.consents?.aiProcessing;
  useEffect(() => {
    setRemoteModel(aiOn ? remoteCoach(state.coachModel) : undefined);
  }, [aiOn, state.coachModel]);

  // Link this phone to the signed-in account: restore first, push after.
  const userId = state.account?.userId;
  const linked = state.sync.linkedUserId;
  useEffect(() => {
    if (!state.hydrated || !userId) return;
    if (linked && linked !== userId) {
      if (getState().sync.lastError !== OTHER_ACCOUNT) dispatch({ type: 'sync', patch: { lastError: OTHER_ACCOUNT } });
      return;
    }
    if (linked || linking.current === userId) return;
    linking.current = userId;
    restore(getState, dispatch, importSets, { link: true }).catch((e: Error) => {
      linking.current = null;
      dispatch({ type: 'sync', patch: { lastError: `Could not read your backup: ${e.message}` } });
    });
  }, [state.hydrated, userId, linked, dispatch, getState, importSets]);

  const key = JSON.stringify([
    userId,
    linked,
    Object.values(state.sessions).map((s) => [s.key, s.status, s.feel]),
    state.sets.length,
    Object.values(state.checkIns),
    state.consents?.at,
    state.readiness?.at,
    state.restrictions,
    state.safetyEvents.length,
    state.reports.length,
    state.profile?.tone,
    state.nutrition,
    state.meals.length,
    state.meals.reduce((m, x) => (x.updatedAt && x.updatedAt > m ? x.updatedAt : m), ''),
    state.savedMeals.length,
    state.sync.deleted.length,
  ]);
  useEffect(() => {
    if (!state.hydrated || !userId || linked !== userId) return;
    const t = setTimeout(() => void requestPush(getState, dispatch), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state.hydrated]);

  return null;
}
