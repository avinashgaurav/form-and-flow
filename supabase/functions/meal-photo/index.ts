import { aiSetup, callModel } from '../_shared/ai.ts';
import { DEFAULT_COACH_MODEL, isCoachModel } from '../_shared/coach-prompt.ts';
import { CORS, fail, json, requireUser, serviceClient } from '../_shared/http.ts';
import { PHOTO_PROMPT_VERSION, toPhotoOutput } from '../_shared/photo-prompt.ts';
import { geminiPhotoRequest } from '../_shared/gemini.ts';
import { providerModel } from '../_shared/provider.ts';
import { photoRequest } from '../_shared/requests.ts';
import { startRun } from '../_shared/run.ts';
import { PHOTO_MAX_BASE64, parsePhotoBody } from '../_shared/validate.ts';

/**
 * POST /meal-photo: name the foods and amounts in one meal photo.
 *
 * The model returns only names, amounts and units; the phone matches them to its catalogue and
 * its engine computes every nutrient, and the user checks each item before anything is saved.
 * The photo is passed straight to the model and never stored or logged here. The provider (Google
 * Gemini by default, or Anthropic) comes from AI_PROVIDER.
 */

const envModel = Deno.env.get('COACH_MODEL');
const DEFAULT_MODEL = isCoachModel(envModel) ? envModel : DEFAULT_COACH_MODEL;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const traceId = crypto.randomUUID();
  if (req.method !== 'POST') return fail('VALIDATION_ERROR', 'Use POST', 405, traceId);

  // Refuse oversized uploads before reading them at all.
  const declared = Number(req.headers.get('content-length') ?? NaN);
  if (!Number.isFinite(declared) || declared > PHOTO_MAX_BASE64 + 2_000) return fail('VALIDATION_ERROR', 'Photo too large or size unknown', 413, traceId);

  const auth = await requireUser(req, traceId);
  if (auth instanceof Response) return auth;
  const { user, userClient } = auth;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return fail('VALIDATION_ERROR', 'Body must be JSON', 400, traceId);
  }
  const body = parsePhotoBody(raw);
  if (typeof body === 'string') return fail('VALIDATION_ERROR', body, 400, traceId);

  const setup = aiSetup(traceId);
  if (setup instanceof Response) return setup;
  const run = await startRun({ user, userClient, admin: serviceClient(), traceId }, 'meal_parse', providerModel(setup.provider, body.model ?? DEFAULT_MODEL), PHOTO_PROMPT_VERSION, setup.provider);
  if (run instanceof Response) return run;
  const { model } = run;

  const args = { image: body.image, media_type: body.media_type };
  const result = await callModel(setup, { anthropic: () => photoRequest({ model, ...args }), gemini: () => geminiPhotoRequest({ model, ...args }) }, { timeoutMs: 40_000, maxRetries: 1 });
  if (!result.ok) {
    console.error('meal-photo: provider call failed', traceId, result.reason);
    await run.done({ schema_valid: false, stop_reason: result.reason });
    return fail('DEPENDENCY_UNAVAILABLE', 'The AI service is not available right now', 503, traceId);
  }

  const response = result.reply;
  const usage = { model: response.model, input_tokens: response.input_tokens, output_tokens: response.output_tokens };
  if (response.stop_reason === 'refusal') {
    await run.done({ ...usage, schema_valid: false, stop_reason: 'refusal' });
    return fail('MODEL_DECLINED', 'The AI could not read this photo', 422, traceId);
  }
  let output: unknown;
  try {
    if (response.stop_reason !== 'end_turn' || response.text === null) throw new Error(response.stop_reason);
    // Only a bounded food list goes back: never free text read out of an image.
    output = toPhotoOutput(JSON.parse(response.text));
  } catch {
    await run.done({ ...usage, schema_valid: false, stop_reason: response.stop_reason });
    return fail('DEPENDENCY_UNAVAILABLE', 'The AI reply could not be used', 502, traceId);
  }
  await run.done({ ...usage, schema_valid: true, stop_reason: 'end_turn' });
  return json({ output, model: response.model, prompt_version: PHOTO_PROMPT_VERSION, trace_id: traceId });
});
