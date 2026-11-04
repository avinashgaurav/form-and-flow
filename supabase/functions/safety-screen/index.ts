import Anthropic from '@anthropic-ai/sdk';
import { CORS, fail, json, requireUser, serviceClient } from '../_shared/http.ts';
import { screenRequest } from '../_shared/requests.ts';
import { startRun } from '../_shared/run.ts';
import { parseScreenOutput, SCREEN_MODEL, SCREEN_MODEL_TIMEOUT_MS, SCREEN_PROMPT_VERSION } from '../_shared/screen-prompt.ts';
import { parseScreenBody } from '../_shared/validate.ts';

/**
 * POST /safety-screen: the AI safety screen, second layer after the phone's safety word list.
 *
 * The phone sends only the message (never facts or profile), and only for messages the word list did
 * not catch, with AI consent. The function returns one category from a fixed list. It never writes a
 * reply: the phone maps the category to a fixed safe reply, and any error from here (consent, limits,
 * timeout, refusal, a malformed answer) makes the phone show the fixed safe reply too. The message is
 * not stored; model_runs keeps only the purpose, model, token counts and outcome.
 */

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY'), timeout: SCREEN_MODEL_TIMEOUT_MS, maxRetries: 0 });

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

  const run = await startRun({ user, userClient, admin: serviceClient(), traceId }, 'safety_screen', SCREEN_MODEL, SCREEN_PROMPT_VERSION);
  if (run instanceof Response) return run;
  const done = run.done;

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await anthropic.beta.messages.create(screenRequest({ message: body.message, model: run.model }));
  } catch (e) {
    const reason = e instanceof Anthropic.APIConnectionTimeoutError ? 'provider_timeout' : e instanceof Anthropic.RateLimitError ? 'provider_rate_limited' : e instanceof Anthropic.APIError ? `provider_error_${e.status ?? 'unknown'}` : 'provider_unreachable';
    console.error('safety-screen: provider call failed', traceId, reason);
    await done({ schema_valid: false, stop_reason: reason });
    return fail('DEPENDENCY_UNAVAILABLE', 'The safety check is not available right now', 503, traceId);
  }

  const usage = { model: response.model, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
  // A refusal to classify is not a "none": the phone shows the fixed safe reply.
  if (response.stop_reason === 'refusal') {
    await done({ ...usage, schema_valid: false, stop_reason: 'refusal' });
    return fail('MODEL_DECLINED', 'The safety check declined this message', 422, traceId);
  }
  const block = response.content.find((b) => b.type === 'text');
  let category: ReturnType<typeof parseScreenOutput> = null;
  try {
    if (response.stop_reason === 'end_turn' && block && block.type === 'text') category = parseScreenOutput(JSON.parse(block.text));
  } catch {
    category = null;
  }
  if (!category) {
    await done({ ...usage, schema_valid: false, stop_reason: response.stop_reason ?? 'unknown' });
    return fail('DEPENDENCY_UNAVAILABLE', 'The safety check answer could not be used', 502, traceId);
  }
  await done({ ...usage, schema_valid: true, stop_reason: 'end_turn' });
  return json({ category, prompt_version: SCREEN_PROMPT_VERSION, trace_id: traceId });
});
