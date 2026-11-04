/**
 * Eval-only: sends one request built by the server's own Gemini request builders (gemini.ts) straight to
 * the Gemini API, through the server's own callGemini and answer reader. Returns the same record shape
 * as cli.ts, so run.ts, screen-only.ts and the score scripts work unchanged. Never imported by app code.
 *
 * The key comes from GEMINI_API_KEY in the environment and is sent only in the request header.
 *
 * Differences from the app, on purpose, so the test measures answers rather than Google's load on the day:
 * a 60 s limit per attempt instead of the app's 4 s (screen) or 25 s (coach), calls spaced to stay under the
 * free tier's per-minute limit, and up to 5 more attempts, with waits, after a 429, a 5xx, a timeout or a
 * network error. Every attempt's outcome is recorded, and
 * the time of the answered attempt is kept, so the write-up can say how many calls the app itself would
 * have lost to its own time limit or to an outage (the app then shows the fixed safe reply, or answers
 * from its rules).
 */
import { callGemini, type GeminiRequest } from '../../supabase/functions/_shared/gemini.ts';
import { screenDecision, type ModelReply } from '../../supabase/functions/_shared/provider.ts';
import type { CliResult } from './cli.ts';

/**
 * Published paid-tier prices per million tokens (input, output including thinking), from
 * https://ai.google.dev/gemini-api/docs/pricing, read on 2026-11-04. Costs are estimates.
 */
export const GEMINI_PRICE: Record<string, [number, number]> = {
  'gemini-3.5-flash-lite': [0.3, 2.5],
  'gemini-3.6-flash': [0.75, 3.75],
  'gemini-3.8-flash': [0.75, 3.75],
};

export interface GeminiEvalResult extends CliResult {
  /** The answer as read by the server's code ('end_turn', 'refusal' for a content-filter block, ...). */
  stop_reason: string | null;
  /** Every attempt: 'answered' or the failure reason the server would have logged. */
  attempts: string[];
  /** For a screen call: what the safety-screen function would do with the first attempt's result. */
  screen_decision?: string;
}

/**
 * Our key is on Google's free tier, which allows 15 requests a minute per model. Calls are spaced so the
 * test stays under that (GEMINI_EVAL_RPM, default 12 a minute per model); 429s that still happen are retried.
 */
const RPM = Number(process.env.GEMINI_EVAL_RPM ?? 12);
const nextSlot = new Map<string, number>();
async function waitTurn(model: string) {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(model) ?? 0);
  nextSlot.set(model, at + 60_000 / RPM);
  if (at > now) await new Promise<void>((r) => setTimeout(r, at - now));
}

const RETRY = /^(provider_rate_limited|provider_error_5\d\d|provider_timeout|provider_unreachable|provider_error_408|provider_error_409)$/;
const WAIT_MS = [2_000, 5_000, 10_000, 20_000, 30_000];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function estimateCost(r: ModelReply): number | null {
  const p = GEMINI_PRICE[r.model] ?? GEMINI_PRICE[r.model.replace(/-\d{3,}$/, '')];
  return p ? (r.input_tokens * p[0] + r.output_tokens * p[1]) / 1e6 : null;
}

export async function callGeminiEval(req: GeminiRequest, kind: 'screen' | 'coach'): Promise<GeminiEvalResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Set GEMINI_API_KEY in this terminal first.');
  const attempts: string[] = [];
  let firstDecision: string | undefined;
  for (let i = 0; i <= WAIT_MS.length; i++) {
    if (i > 0) await sleep(WAIT_MS[i - 1]!);
    await waitTurn(req.model);
    const t0 = Date.now();
    const result = await callGemini(req, { apiKey, timeoutMs: 60_000, maxRetries: 0 });
    const ms = Date.now() - t0;
    if (kind === 'screen' && firstDecision === undefined) {
      const d = screenDecision(result);
      firstDecision = d.kind === 'category' ? d.category : d.kind;
    }
    if (!result.ok) {
      attempts.push(result.reason);
      if (RETRY.test(result.reason)) continue;
      return { ok: false, structured: null, error: result.reason, models: [], ms, usage: null, costUsd: null, stop_reason: null, attempts, screen_decision: firstDecision };
    }
    attempts.push('answered');
    const r = result.reply;
    let structured: unknown = null;
    try {
      if (r.stop_reason === 'end_turn' && r.text !== null) structured = JSON.parse(r.text);
    } catch {
      structured = null;
    }
    return {
      ok: structured !== null,
      structured,
      error: structured !== null ? undefined : r.stop_reason === 'refusal' ? 'refusal (Google content filter or decline)' : `no usable JSON (stop ${r.stop_reason})`,
      models: [r.model],
      ms,
      usage: { input: r.input_tokens, output: r.output_tokens, cacheRead: 0, cacheWrite: 0 },
      costUsd: estimateCost(r),
      stop_reason: r.stop_reason,
      attempts,
      screen_decision: kind === 'screen' ? (firstDecision ?? undefined) : undefined,
    };
  }
  return { ok: false, structured: null, error: `gave up after ${attempts.length} attempts: ${attempts.join(', ')}`, models: [], ms: 0, usage: null, costUsd: null, stop_reason: null, attempts, screen_decision: firstDecision };
}
