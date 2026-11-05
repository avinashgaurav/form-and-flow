import { COACH_OUTPUT_SCHEMA, renderCoachPrompt, type CoachModelId, type CoachTone } from './coach-prompt.ts';
import { PHOTO_OUTPUT_SCHEMA, PHOTO_SYSTEM } from './photo-prompt.ts';
import { SCREEN_OUTPUT_SCHEMA, SCREEN_SYSTEM, wrapScreenMessage } from './screen-prompt.ts';
import type { ModelReply, ModelResult } from './provider.ts';

/**
 * The exact Google Gemini requests the server functions send, and how a Gemini answer is read, in one
 * place (the Gemini twin of requests.ts). Plain TypeScript with no Deno APIs, so the Node tests, the
 * smoke test and the eval harness use the same code as the functions.
 *
 * REST API, v1beta generateContent. The key goes only in the x-goog-api-key header, never in the URL.
 */

export const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * The app's three model choices (Settings) mapped to Gemini models. The ids on the wire stay the same so
 * existing phones keep working; the server picks the provider's model. Chosen on 2026-11-04 from the
 * models list for our key and test calls: the Pro models answered 429 (no quota on this key) and
 * gemini-3.8-flash answered 503 ("high demand") to all 12 test calls, so "Balanced" and "Most capable"
 * both use gemini-3.6-flash, the strongest Flash model that answered.
 */
export const GEMINI_MODELS: Record<CoachModelId, string> = {
  'claude-haiku-5-5': 'gemini-3.5-flash-lite',
  'claude-sonnet-5-5': 'gemini-3.6-flash',
  'claude-opus-5-5': 'gemini-3.6-flash',
};

/** The safety screen's fixed model: small and fast, like Haiku on the Anthropic path. */
export const GEMINI_SCREEN_MODEL = 'gemini-3.5-flash-lite';

/** Same idea as `effort: 'low'` on the Anthropic path: a little thinking, quick answers. */
const THINKING = { thinkingLevel: 'low' } as const;

/**
 * Google's own content filters are switched off for the safety screen only. The screen must be able to
 * read a message about self-harm in order to classify it, it only ever answers one word from a fixed
 * list, and the user never sees its output. A block would still fail closed (fixed safe reply), but it
 * would lose the kind of reply (crisis or emergency). The coach and photo calls keep Google's defaults.
 */
const SCREEN_SAFETY_SETTINGS = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map((category) => ({
  category,
  threshold: 'BLOCK_NONE',
}));

export interface GeminiRequest {
  model: string;
  body: {
    systemInstruction: { parts: { text: string }[] };
    contents: { role: 'user'; parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] }[];
    generationConfig: {
      maxOutputTokens: number;
      responseMimeType: 'application/json';
      responseSchema: GeminiSchema;
      thinkingConfig: typeof THINKING;
    };
    safetySettings?: { category: string; threshold: string }[];
  };
}

export interface GeminiSchema {
  type: 'OBJECT' | 'ARRAY' | 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN';
  nullable?: boolean;
  enum?: string[];
  properties?: Record<string, GeminiSchema>;
  propertyOrdering?: string[];
  required?: string[];
  items?: GeminiSchema;
}

/**
 * The app's JSON schemas in Gemini's responseSchema form (an OpenAPI subset): types in capitals,
 * `anyOf [X, null]` becomes `X` with `nullable`, and `additionalProperties` is dropped because the
 * field does not exist there. Extra fields are still refused, by the strict parsers that read every
 * answer (parseScreenOutput, toModelOutput, toPhotoOutput). Anything else unknown throws, so a schema
 * change cannot silently lose a rule.
 */
export function toGeminiSchema(s: unknown): GeminiSchema {
  const o = s as Record<string, unknown>;
  if (Array.isArray(o.anyOf)) {
    const parts = o.anyOf as Record<string, unknown>[];
    const real = parts.filter((p) => p.type !== 'null');
    if (parts.length !== 2 || real.length !== 1) throw new Error('toGeminiSchema: only anyOf [X, null] is supported');
    return { ...toGeminiSchema(real[0]), nullable: true };
  }
  const known = new Set(['type', 'enum', 'properties', 'required', 'items', 'additionalProperties']);
  const unknown = Object.keys(o).filter((k) => !known.has(k));
  if (unknown.length) throw new Error(`toGeminiSchema: unsupported keyword ${unknown.join(', ')}`);
  const types: Record<string, GeminiSchema['type']> = { object: 'OBJECT', array: 'ARRAY', string: 'STRING', number: 'NUMBER', integer: 'INTEGER', boolean: 'BOOLEAN' };
  const type = types[String(o.type)];
  if (!type) throw new Error(`toGeminiSchema: unsupported type ${String(o.type)}`);
  const out: GeminiSchema = { type };
  if (Array.isArray(o.enum)) out.enum = [...(o.enum as string[])];
  if (o.properties) {
    const props = o.properties as Record<string, unknown>;
    out.properties = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, toGeminiSchema(v)]));
    out.propertyOrdering = Object.keys(props);
  }
  if (Array.isArray(o.required)) out.required = [...(o.required as string[])];
  if (o.items) out.items = toGeminiSchema(o.items);
  return out;
}

const COACH_SCHEMA = toGeminiSchema(COACH_OUTPUT_SCHEMA);
const SCREEN_SCHEMA = toGeminiSchema(SCREEN_OUTPUT_SCHEMA);
const PHOTO_SCHEMA = toGeminiSchema(PHOTO_OUTPUT_SCHEMA);

function config(maxOutputTokens: number, responseSchema: GeminiSchema): GeminiRequest['body']['generationConfig'] {
  return { maxOutputTokens, responseMimeType: 'application/json', responseSchema, thinkingConfig: THINKING };
}

/** Same prompt, facts, retry note and output limit as coachRequest. `model` is the Gemini model id. */
export function geminiCoachRequest(p: { model: string; tone: CoachTone; facts: Record<string, number | string>; retry: boolean; message: string }): GeminiRequest {
  return {
    model: p.model,
    body: {
      systemInstruction: { parts: [{ text: renderCoachPrompt(p.tone, p.facts, p.retry) }] },
      contents: [{ role: 'user', parts: [{ text: p.message }] }],
      generationConfig: config(1500, COACH_SCHEMA),
    },
  };
}

/** Same fixed prompt, wrapped message and schema as screenRequest: no facts, no profile. */
export function geminiScreenRequest(p: { message: string; model?: string }): GeminiRequest {
  return {
    model: p.model ?? GEMINI_SCREEN_MODEL,
    body: {
      systemInstruction: { parts: [{ text: SCREEN_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: wrapScreenMessage(p.message) }] }],
      generationConfig: config(1000, SCREEN_SCHEMA),
      safetySettings: SCREEN_SAFETY_SETTINGS,
    },
  };
}

export function geminiPhotoRequest(p: { model: string; image: string; media_type: 'image/jpeg' | 'image/png' | 'image/webp' }): GeminiRequest {
  return {
    model: p.model,
    body: {
      systemInstruction: { parts: [{ text: PHOTO_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType: p.media_type, data: p.image } }, { text: 'List the foods in this meal photo.' }] }],
      generationConfig: config(1500, PHOTO_SCHEMA),
    },
  };
}

/** Finish reasons that mean Google's filters stopped the answer (including LANGUAGE, an unsupported language): handled like a refusal. */
const BLOCKED = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY', 'IMAGE_PROHIBITED_CONTENT', 'IMAGE_RECITATION', 'LANGUAGE']);

/**
 * A generateContent answer in the same shape the Anthropic path gives (provider.ts): stop_reason is
 * 'end_turn' for a normal finish, 'refusal' when Google blocked the prompt or the answer, 'max_tokens'
 * when the output limit was hit, and the lower-cased finish reason otherwise. Thinking tokens are billed
 * as output, so they are counted as output tokens. Thought parts are never treated as the answer.
 */
export function parseGeminiResponse(raw: unknown, requestedModel: string): ModelReply {
  const r = (raw && typeof raw === 'object' ? raw : {}) as {
    candidates?: { finishReason?: string; content?: { parts?: { text?: unknown; thought?: unknown }[] } }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    modelVersion?: string;
  };
  const u = r.usageMetadata ?? {};
  const base = {
    model: typeof r.modelVersion === 'string' && r.modelVersion ? r.modelVersion : requestedModel,
    input_tokens: u.promptTokenCount ?? 0,
    output_tokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
  };
  if (r.promptFeedback?.blockReason) return { ...base, stop_reason: 'refusal', text: null };
  const c = Array.isArray(r.candidates) ? r.candidates[0] : undefined;
  if (!c) return { ...base, stop_reason: 'no_candidate', text: null };
  const finish = String(c.finishReason ?? 'unknown');
  const stop_reason = finish === 'STOP' ? 'end_turn' : BLOCKED.has(finish) ? 'refusal' : finish === 'MAX_TOKENS' ? 'max_tokens' : finish.toLowerCase();
  const parts = Array.isArray(c.content?.parts) ? c.content!.parts! : [];
  const text = parts.filter((p) => typeof p.text === 'string' && p.thought !== true).map((p) => p.text as string).join('');
  return { ...base, stop_reason, text: text ? text : null };
}

export interface GeminiCallOptions {
  apiKey: string;
  timeoutMs: number;
  /** Extra tries after the first, for 408, 409, 429, 5xx, timeouts and network errors (as the Anthropic SDK does). */
  maxRetries: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const RETRYABLE = (status: number) => status === 408 || status === 409 || status === 429 || status >= 500;

/**
 * Sends one request. Never throws. Errors come back as the same stop reasons the functions already log:
 * provider_timeout, provider_rate_limited (429), provider_error_<status>, provider_unreachable, and
 * provider_bad_response for a 200 whose body is not JSON. The key is sent only in the header and is
 * never part of an error message.
 */
export async function callGemini(req: GeminiRequest, o: GeminiCallOptions): Promise<ModelResult> {
  const doFetch = o.fetch ?? fetch;
  const sleep = o.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const url = `${GEMINI_ENDPOINT}/${encodeURIComponent(req.model)}:generateContent`;
  let reason = 'provider_unreachable';
  for (let attempt = 0; attempt <= o.maxRetries; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** (attempt - 1));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), o.timeoutMs);
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': o.apiKey },
        body: JSON.stringify(req.body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        reason = res.status === 429 ? 'provider_rate_limited' : `provider_error_${res.status}`;
        await res.body?.cancel().catch(() => undefined);
        if (RETRYABLE(res.status)) continue;
        return { ok: false, reason };
      }
      let json: unknown;
      try {
        json = await res.json();
      } catch {
        return { ok: false, reason: ctrl.signal.aborted ? 'provider_timeout' : 'provider_bad_response' };
      }
      return { ok: true, reply: parseGeminiResponse(json, req.model) };
    } catch (e) {
      reason = ctrl.signal.aborted ? 'provider_timeout' : 'provider_unreachable';
      // The error name only: a message could echo the request.
      if (reason === 'provider_unreachable') console.error(`gemini fetch failed: ${(e as Error)?.name ?? 'unknown'}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, reason };
}
