import { coachTurn, shortenSession, substitutes, type CoachContext, type CoachReply, type ModelCall } from '@ff/engines';
import type { AppState } from '../store/types';
import { numericMode, nutritionFacts } from './food';
import { currentPlan, effectiveSession, plannedFor, todayIndex } from './plan';

/** Build the coach context from local state. Only this user's own data, minimised (ADR-06). */
export function coachContext(state: AppState): CoachContext {
  const profile = state.profile!;
  const plan = currentPlan(state);
  const dayIdx = todayIndex(state);
  const fresh = plan?.week.sessions.find((s) => s.day === dayIdx);
  const planned = fresh ? plannedFor(state, fresh.id) : undefined;
  const log = fresh ? state.sessions[fresh.id] : undefined;
  const today = planned && log?.status !== 'completed' ? effectiveSession(planned, log) : undefined;
  return {
    tone: profile.tone,
    today,
    restDay: !fresh,
    sessionsDoneThisWeek: plan?.week.sessions.filter((s) => state.sessions[s.id]?.status === 'completed').length ?? 0,
    sessionsPlannedThisWeek: plan?.week.sessions.length ?? 0,
    equipment: profile.training.equipment,
    experience: profile.training.experience,
    restrictions: state.restrictions,
    planReasons: plan?.week.reasons.map((r) => r.text) ?? [],
    extraFacts: nutritionFacts(state),
    nutritionMode: numericMode(state) ? 'numeric' : 'non_numeric',
  };
}

/** The model is only reachable through our server, and only with AI consent (set in lib/backend). */
let remoteModel: ModelCall | undefined;
export function setRemoteModel(m: ModelCall | undefined) {
  remoteModel = m;
}

export function ask(state: AppState, message: string): Promise<CoachReply> {
  return coachTurn(message, coachContext(state), { aiAllowed: !!state.consents?.aiProcessing, model: remoteModel });
}

/** Turn a confirmed shorten action into the same session patch the Today screen uses. */
export function shortenPatch(state: AppState, minutes: number) {
  const plan = currentPlan(state);
  const fresh = plan?.week.sessions.find((s) => s.day === todayIndex(state));
  if (!fresh) return null;
  const planned = plannedFor(state, fresh.id)!;
  const r = shortenSession(planned, minutes);
  if (r.kind !== 'session') return null;
  return { key: fresh.id, patch: { shortened: { minutes, blocks: r.session.blocks, warmup: r.session.warmup } } };
}

/** Swaps are keyed by the planned exercise; map the exercise the user sees back to it. */
export function swapPatch(state: AppState, from: string, to: string) {
  const plan = currentPlan(state);
  const fresh = plan?.week.sessions.find((s) => s.day === todayIndex(state));
  if (!fresh) return null;
  // Re-checked at confirm time: limits or equipment may have changed since the coach replied.
  const profile = state.profile!;
  const allowed = substitutes(from, { equipment: profile.training.equipment, restrictions: state.restrictions, experience: profile.training.experience });
  if (!allowed.some((e) => e.id === to)) return null;
  const log = state.sessions[fresh.id];
  const swaps = { ...(log?.swaps ?? {}) };
  const base = Object.entries(swaps).find(([, v]) => v === from)?.[0] ?? from;
  swaps[base] = to;
  return { key: fresh.id, patch: { swaps } };
}
