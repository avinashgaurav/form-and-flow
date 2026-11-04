import { aiSetup, callModel } from '../_shared/ai.ts';
import { COACH_PROMPT_VERSION, DEFAULT_COACH_MODEL, isCoachModel, toModelOutput } from '../_shared/coach-prompt.ts';
import { CORS, fail, json, requireUser, serviceClient } from '../_shared/http.ts';
import { geminiCoachRequest } from '../_shared/gemini.ts';
import { providerModel } from '../_shared/provider.ts';
import { coachRequest } from '../_shared/requests.ts';
import { startRun } from '../_shared/run.ts';
import { parseCoachBody } from '../_shared/validate.ts';

/**
 * POST /coach: one coach turn (plan/12 section 5.3, plan/13 sections 1 and 4).
 *
 * The phone runs the safety lexicon, the rules and the validators; this function only phrases.
 * It builds the system prompt itself from its own copy of the prompt and accepts only facts from
 * a fixed list, so it is not a general model proxy. The provider (Google Gemini by default, or
 * Anthropic) comes from AI_PROVIDER (shared/ai.ts). Consent, an hourly call limit and a daily
 * token cap are checked before every call (shared/run.ts). Any failure returns an error and the phone answers
 * from its rules instead.
 */

// The user picks a model in Settings (COACH_MODELS). COACH_MODEL only sets the default for users who have not.
// The choice is mapped to the provider's own model (shared/provider.ts).
const envModel = Deno.env.get('COACH_MODEL');
const DEFAULT_MODEL = isCoachModel(envModel) ? envModel : DEFAULT_COACH_MODEL;

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
  const body = parseCoachBody(raw);
  if (typeof body === 'string') return fail('VALIDATION_ERROR', body, 400, traceId);

  const setup = aiSetup(traceId);
  if (setup instanceof Response) return setup;
  const admin = serviceClient();
  const choice = body.model ?? DEFAULT_MODEL;
  const run = await startRun({ user, userClient, admin, traceId }, 'coach_turn', providerModel(setup.provider, choice), COACH_PROMPT_VERSION, setup.provider);
  if (run instanceof Response) return run;
  const { model } = run;
  const done = run.done;

  const args = { tone: body.tone, facts: body.facts, retry: body.retry, message: body.message };
  const result = await callModel(setup, { anthropic: () => coachRequest({ model, ...args }), gemini: () => geminiCoachRequest({ model, ...args }) }, { timeoutMs: 25_000, maxRetries: 1 });
  if (!result.ok) {
    console.error('coach: provider call failed', traceId, result.reason);
    await done({ schema_valid: false, stop_reason: result.reason });
    return fail('DEPENDENCY_UNAVAILABLE', 'The AI service is not available right now', 503, traceId);
  }

  const response = result.reply;
  const usage = { model: response.model, input_tokens: response.input_tokens, output_tokens: response.output_tokens };
  // A decline, or a Gemini content-filter block: the phone treats it as a rejected reply and answers from its rules.
  if (response.stop_reason === 'refusal') {
    await done({ ...usage, schema_valid: false, stop_reason: 'refusal' });
    return fail('MODEL_DECLINED', 'The AI declined this message', 422, traceId);
  }
  let output: ReturnType<typeof toModelOutput>;
  try {
    if (response.stop_reason !== 'end_turn' || response.text === null) throw new Error(response.stop_reason);
    output = toModelOutput(JSON.parse(response.text));
  } catch {
    await done({ ...usage, schema_valid: false, stop_reason: response.stop_reason });
    return fail('DEPENDENCY_UNAVAILABLE', 'The AI reply could not be used', 502, traceId);
  }
  await done({ ...usage, schema_valid: true, stop_reason: 'end_turn' });
  return json({ output, model: response.model, prompt_version: COACH_PROMPT_VERSION, trace_id: traceId });
});
