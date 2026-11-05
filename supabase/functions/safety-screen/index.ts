import { aiSetup, callModel } from '../_shared/ai.ts';
import { CORS, fail, json, requireUser, serviceClient } from '../_shared/http.ts';
import { geminiScreenRequest } from '../_shared/gemini.ts';
import { providerScreenModel, screenDecision } from '../_shared/provider.ts';
import { screenRequest } from '../_shared/requests.ts';
import { startRun } from '../_shared/run.ts';
import { SCREEN_MODEL_TIMEOUT_MS, SCREEN_PROMPT_VERSION } from '../_shared/screen-prompt.ts';
import { parseScreenBody } from '../_shared/validate.ts';

/**
 * POST /safety-screen: the AI safety screen, second layer after the phone's safety word list.
 *
 * The phone sends only the message (never facts or profile), and only for messages the word list did
 * not catch, with AI consent. The function returns one category from a fixed list. It never writes a
 * reply: the phone maps the category to a fixed safe reply, and any error from here (consent, limits,
 * timeout, refusal, a malformed answer) makes the phone show the fixed safe reply too. The message is
 * not stored; model_runs keeps only the purpose, model, token counts and outcome. The provider (Google
 * Gemini or Anthropic) comes from AI_PROVIDER; a Gemini content-filter block is handled like
 * a refusal, so it also gets the fixed safe reply.
 */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const traceId = crypto.randomUUID();
  if (req.method !== 'POST') return fail('VALIDATION_ERROR', 'Use POST', 405, traceId);

  const auth = await requireUser(req, traceId);
  if (auth instanceof Response) return auth;
  const { user, userClient } = auth;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail('VALIDATION_ERROR', 'Body must be JSON', 400, traceId);
  }
  const body = parseScreenBody(raw);
  if (typeof body === 'string') return fail('VALIDATION_ERROR', body, 400, traceId);

  const setup = aiSetup(traceId);
  if (setup instanceof Response) return setup;
  const run = await startRun({ user, userClient, admin: serviceClient(), traceId }, 'safety_screen', providerScreenModel(setup.provider), SCREEN_PROMPT_VERSION, setup.provider);
  if (run instanceof Response) return run;
  const done = run.done;

  const result = await callModel(
    setup,
    { anthropic: () => screenRequest({ message: body.message, model: run.model }), gemini: () => geminiScreenRequest({ message: body.message, model: run.model }) },
    { timeoutMs: SCREEN_MODEL_TIMEOUT_MS, maxRetries: 0, timeoutReason: true },
  );
  // Only a clean, schema-valid category is passed on; everything else fails closed (shared/provider.ts).
  const d = screenDecision(result);
  if (d.kind === 'failed') console.error('safety-screen: provider call failed', traceId, d.stop_reason);
  await done({ ...d.usage, schema_valid: d.kind === 'category', stop_reason: d.stop_reason });
  if (d.kind === 'failed') return fail('DEPENDENCY_UNAVAILABLE', 'The safety check is not available right now', 503, traceId);
  if (d.kind === 'declined') return fail('MODEL_DECLINED', 'The safety check declined this message', 422, traceId);
  if (d.kind === 'unusable') return fail('DEPENDENCY_UNAVAILABLE', 'The safety check answer could not be used', 502, traceId);
  const category = d.category;
  return json({ category, provider: setup.provider, prompt_version: SCREEN_PROMPT_VERSION, trace_id: traceId });
});
