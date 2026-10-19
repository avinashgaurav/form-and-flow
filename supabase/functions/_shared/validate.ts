/**
 * Request validation for the coach function. Pure TypeScript (no Deno APIs) so Node tests can
 * import it. Unknown fields are rejected (plan/12 section 5.2). Facts end up in the system prompt,
 * so their names come from a fixed list and text values are short plain words: the phone cannot
 * smuggle instructions in through them.
 */
import { COACH_MESSAGE_MAX, isCoachModel, type CoachModelId, type CoachTone } from './coach-prompt.ts';

export interface CoachBody {
  message: string;
  tone: CoachTone;
  facts: Record<string, number | string>;
  retry: boolean;
  /** The user's choice from COACH_MODELS; absent means the server default. */
  model?: CoachModelId;
}

const TONES: CoachTone[] = ['direct', 'gentle', 'data'];

/** Every fact name the engines produce (buildFacts and the nutrition facts). */
export const FACT_KEY =
  /^(sessions_(done|planned)_this_week|today_(session|minutes|exercises)|ex([1-9]|1[0-2])(_(sets|rep_min|rep_max|rest_sec|rir))?|energy_kcal_(low|high)|protein_(kind|g_low|g_default|g_high))$/;
/** Text facts are exercise and session names or a protein kind. */
const FACT_TEXT = /^[A-Za-z0-9 ,.'()&+/-]{1,60}$/;
const MAX_FACTS = 80;

export function parseCoachBody(raw: unknown): CoachBody | string {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'Body must be a JSON object';
  const b = raw as Record<string, unknown>;
  const extra = Object.keys(b).filter((k) => !['message', 'tone', 'facts', 'retry', 'model'].includes(k));
  if (extra.length) return `Unknown fields: ${extra.join(', ')}`;
  if (typeof b.message !== 'string' || !b.message.trim() || b.message.length > COACH_MESSAGE_MAX) return `message must be 1 to ${COACH_MESSAGE_MAX} characters`;
  if (!TONES.includes(b.tone as CoachTone)) return 'tone must be direct, gentle or data';
  if (!b.facts || typeof b.facts !== 'object' || Array.isArray(b.facts)) return 'facts must be an object';
  const facts = b.facts as Record<string, unknown>;
  const keys = Object.keys(facts);
  if (keys.length > MAX_FACTS) return 'Too many facts';
  for (const k of keys) {
    const v = facts[k];
    if (!FACT_KEY.test(k)) return `Unknown fact: ${k.slice(0, 40)}`;
    const ok = (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 100_000) || (typeof v === 'string' && FACT_TEXT.test(v));
    if (!ok) return `Bad fact value: ${k}`;
  }
  if (b.retry !== undefined && typeof b.retry !== 'boolean') return 'retry must be true or false';
  if (b.model !== undefined && !isCoachModel(b.model)) return 'model must be one of the offered coach models';
  return {
    message: b.message,
    tone: b.tone as CoachTone,
    facts: facts as Record<string, number | string>,
    retry: b.retry === true,
    model: b.model as CoachModelId | undefined,
  };
}

/** Same value as the SQL function hash_user_id(uuid): hex SHA-256 of the UUID text. */
export async function hashUserId(id: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id.toLowerCase()));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * When the user last proved who they are, from the token's `amr` claim (sign-in method times).
 * Unlike last_sign_in_at this does not move when a session is refreshed. Returns ms, or 0.
 */
export function lastAuthAt(jwt: string): number {
  try {
    const part = jwt.split('.')[1] ?? '';
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')));
    const times = (Array.isArray(json.amr) ? json.amr : []).map((a: { timestamp?: unknown }) => Number(a?.timestamp)).filter(Number.isFinite);
    return times.length ? Math.max(...times) * 1000 : 0;
  } catch {
    return 0;
  }
}
