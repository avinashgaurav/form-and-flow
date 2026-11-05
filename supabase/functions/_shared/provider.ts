import type { CoachModelId } from './coach-prompt.ts';
import { GEMINI_MODELS, GEMINI_SCREEN_MODEL } from './gemini.ts';
import { parseScreenOutput, SCREEN_MODEL, type ScreenCategory } from './screen-prompt.ts';

/**
 * Which AI company the server functions call, from the AI_PROVIDER secret. Plain TypeScript (no Deno
 * APIs) so Node tests can import it.
 *
 * gemini: Google Gemini, key in GEMINI_API_KEY.
 * anthropic: Claude, key in ANTHROPIC_API_KEY, exactly as before.
 * It must be set explicitly. Unset or anything else is a setup mistake: the functions refuse to call
 * any AI rather than guess, because the privacy notice the user agreed to names one provider.
 */
export type Provider = 'gemini' | 'anthropic';

export function parseProvider(value: string | undefined): Provider | null {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'gemini') return 'gemini';
  if (v === 'anthropic') return 'anthropic';
  return null;
}

/**
 * Privacy notice versions that name Google (Gemini). The app keeps the same list in
 * app/src/store/types.ts (a test checks they match). Every other version named Anthropic.
 */
export const GEMINI_NOTICE_VERSIONS = ['notice-draft-2026-11-04.4', 'notice-draft-2026-11-04.4-noscreen'] as const;

/** Whether the notice the user agreed to named this provider. The server checks this before every call. */
export function noticeNamesProvider(version: string | null | undefined, provider: Provider): boolean {
  const gemini = (GEMINI_NOTICE_VERSIONS as readonly string[]).includes(version ?? '');
  return provider === 'gemini' ? gemini : !gemini;
}

/** The provider's model for one of the app's three choices (the Anthropic ids are the choice ids). */
export function providerModel(provider: Provider, choice: CoachModelId): string {
  return provider === 'gemini' ? GEMINI_MODELS[choice] : choice;
}

export function providerScreenModel(provider: Provider): string {
  return provider === 'gemini' ? GEMINI_SCREEN_MODEL : SCREEN_MODEL;
}

/** One model answer, in the same shape for both providers, so the functions keep one set of rules. */
export interface ModelReply {
  /** The model the provider says served the call. */
  model: string;
  input_tokens: number;
  output_tokens: number;
  /** 'end_turn' for a normal finish, 'refusal' for a decline or a content-filter block. */
  stop_reason: string;
  /** The JSON answer text, or null when there is none. */
  text: string | null;
}

/** A call either got an answer or failed with a stop reason for model_runs (provider_timeout and so on). */
export type ModelResult = { ok: true; reply: ModelReply } | { ok: false; reason: string };

type Usage = Partial<Pick<ModelReply, 'model' | 'input_tokens' | 'output_tokens'>>;

/**
 * What the safety screen function does with a call's result, for both providers. Only a normal finish
 * whose answer passes the strict parser is a category. A failed call, a refusal or content-filter block,
 * a cut-off answer, or anything malformed is not: the function returns an error and the phone shows the
 * fixed safe reply. `stop_reason` is what model_runs records, as before.
 */
export type ScreenDecision =
  | { kind: 'category'; category: ScreenCategory; stop_reason: 'end_turn'; usage: Usage }
  | { kind: 'declined'; stop_reason: 'refusal'; usage: Usage }
  | { kind: 'unusable'; stop_reason: string; usage: Usage }
  | { kind: 'failed'; stop_reason: string; usage: Usage };

export function screenDecision(result: ModelResult): ScreenDecision {
  if (!result.ok) return { kind: 'failed', stop_reason: result.reason, usage: {} };
  const r = result.reply;
  const usage = { model: r.model, input_tokens: r.input_tokens, output_tokens: r.output_tokens };
  if (r.stop_reason === 'refusal') return { kind: 'declined', stop_reason: 'refusal', usage };
  let category: ScreenCategory | null = null;
  try {
    if (r.stop_reason === 'end_turn' && r.text !== null) category = parseScreenOutput(JSON.parse(r.text));
  } catch {
    category = null;
  }
  return category ? { kind: 'category', category, stop_reason: 'end_turn', usage } : { kind: 'unusable', stop_reason: r.stop_reason, usage };
}
