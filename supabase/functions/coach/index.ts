import Anthropic from '@anthropic-ai/sdk';
import { COACH_OUTPUT_SCHEMA, COACH_PROMPT_VERSION, DEFAULT_COACH_MODEL, isCoachModel, renderCoachPrompt, toModelOutput } from '../_shared/coach-prompt.ts';
import { CORS, fail, json, requireUser, serviceClient } from '../_shared/http.ts';
import { hashUserId, parseCoachBody } from '../_shared/validate.ts';

/**
 * POST /coach: one coach turn (plan/12 section 5.3, plan/13 sections 1 and 4).
 *
 * The phone runs the safety lexicon, the rules and the validators; this function only phrases.
 * It builds the system prompt itself from its own copy of the prompt and accepts only facts from
 * a fixed list, so it is not a general model proxy. Consent, an hourly turn limit and a daily
 * token cap are checked before every call. Any failure returns an error and the phone answers
 * from its rules instead.
 */

// The user picks a model in Settings (COACH_MODELS). COACH_MODEL only sets the default for users who have not.
const envModel = Deno.env.get('COACH_MODEL');
const DEFAULT_MODEL = isCoachModel(envModel) ? envModel : DEFAULT_COACH_MODEL;
const TURNS_PER_HOUR = 30;
const TOKENS_PER_DAY = 200_000;
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY'), timeout: 25_000, maxRetries: 1 });

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

  // Consent is read from the user's own append-only records before every model call. The
  // database stamps `at` itself, so a phone cannot back-date or future-date a grant.
  const consent = await userClient
    .from('consent_records')
    .select('granted')
    .eq('purpose', 'ai_processing')
    .order('at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (consent.error) return fail('INTERNAL_ERROR', 'Could not check consent', 500, traceId);
  if (!consent.data?.granted) return fail('FORBIDDEN', 'AI processing is off for this account', 403, traceId);

  const admin = serviceClient();
  const model = body.model ?? DEFAULT_MODEL;

  // Reserve the run first, then count including it: parallel requests can never all slip under
  // the limit, because each sees the others' reservations.
  const reserved = await admin
    .from('model_runs')
    .insert({ user_id: user.id, purpose: 'coach_turn', model, prompt_version: COACH_PROMPT_VERSION, schema_valid: false, stop_reason: 'pending' })
    .select('id')
    .single();
  if (reserved.error) {
    console.error('coach: reserve failed', traceId, reserved.error.message);
    return fail('INTERNAL_ERROR', 'Could not start the coach turn', 500, traceId);
  }
  const runId = reserved.data.id as string;
  const finish = async (fields: Record<string, unknown>) => {
    const r = await admin.from('model_runs').update(fields).eq('id', runId);
    if (r.error) console.error('coach: run update failed', traceId, r.error.message);
  };

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [hour, day] = await Promise.all([
    admin.from('model_runs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', hourAgo).neq('stop_reason', 'rate_limited'),
    admin.from('model_runs').select('input_tokens, output_tokens').eq('user_id', user.id).gte('created_at', dayAgo),
  ]);
  if (hour.error || day.error) {
    await finish({ stop_reason: 'error_limits' });
    return fail('INTERNAL_ERROR', 'Could not check the limits', 500, traceId);
  }
  const tokensToday = (day.data ?? []).reduce((n, r) => n + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
  if ((hour.count ?? 0) > TURNS_PER_HOUR || tokensToday > TOKENS_PER_DAY) {
    await finish({ stop_reason: 'rate_limited' });
    return fail('RATE_LIMITED', 'The coach has reached its limit for now; answers come from your plan’s rules until then', 429, traceId);
  }

  const started = Date.now();
  const done = async (fields: { model?: string; schema_valid: boolean; stop_reason: string; input_tokens?: number; output_tokens?: number }) => {
    await finish({ ...fields, latency_ms: Date.now() - started });
    const log = await admin.from('security_log').insert({ user_ref: await hashUserId(user.id), event: 'model_call', detail: `coach_turn ${fields.stop_reason}` });
    if (log.error) console.error('coach: security log failed', traceId, log.error.message);
  };

  let response: Anthropic.Beta.BetaMessage;
  try {
    response = await anthropic.beta.messages.create({
      model,
      // Replies are at most four sentences; this bounds cost and stops use as a general model.
      max_tokens: 1500,
      // Server-side fallback on a policy decline; Haiku has none, so it is left out there.
      ...(model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
      output_config: { effort: 'low', format: { type: 'json_schema', schema: COACH_OUTPUT_SCHEMA } },
      system: renderCoachPrompt(body.tone, body.facts, body.retry),
      messages: [{ role: 'user', content: body.message }],
    });
  } catch (e) {
    const reason = e instanceof Anthropic.RateLimitError ? 'provider_rate_limited' : e instanceof Anthropic.APIError ? `provider_error_${e.status ?? 'unknown'}` : 'provider_unreachable';
    console.error('coach: provider call failed', traceId, reason);
    await done({ schema_valid: false, stop_reason: reason });
    return fail('DEPENDENCY_UNAVAILABLE', 'The AI service is not available right now', 503, traceId);
  }

  const usage = { model: response.model, input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens };
  if (response.stop_reason === 'refusal') {
    await done({ ...usage, schema_valid: false, stop_reason: 'refusal' });
    return fail('MODEL_DECLINED', 'The AI declined this message', 422, traceId);
  }
  const block = response.content.find((b) => b.type === 'text');
  let output: ReturnType<typeof toModelOutput>;
  try {
    if (response.stop_reason !== 'end_turn' || !block || block.type !== 'text') throw new Error(response.stop_reason ?? 'no text');
    output = toModelOutput(JSON.parse(block.text));
  } catch {
    await done({ ...usage, schema_valid: false, stop_reason: response.stop_reason ?? 'unknown' });
    return fail('DEPENDENCY_UNAVAILABLE', 'The AI reply could not be used', 502, traceId);
  }
  await done({ ...usage, schema_valid: true, stop_reason: 'end_turn' });
  return json({ output, model: response.model, prompt_version: COACH_PROMPT_VERSION, trace_id: traceId });
});
