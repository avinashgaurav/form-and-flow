import type { SupabaseClient, User } from '@supabase/supabase-js';
import { fail } from './http.ts';
import { hashUserId } from './validate.ts';

/**
 * What every model call must pass first (plan/13 section 4), shared by the coach and photo
 * functions so both enforce the same rules: AI consent from the user's own records, then a
 * reserved run counted against an hourly call limit and a daily token cap.
 */

/** Model calls, not turns: a coach turn whose first answer is rejected makes a second call. */
export const CALLS_PER_HOUR = 30;
export const TOKENS_PER_DAY = 200_000;

export interface Run {
  model: string;
  done(fields: { model?: string; schema_valid: boolean; stop_reason: string; input_tokens?: number; output_tokens?: number }): Promise<void>;
}

export async function startRun(
  ctx: { user: User; userClient: SupabaseClient; admin: SupabaseClient; traceId: string },
  purpose: 'coach_turn' | 'meal_parse',
  model: string,
  promptVersion: string,
): Promise<Run | Response> {
  const { user, userClient, admin, traceId } = ctx;

  // The database stamps consent time itself, so a phone cannot back-date or future-date a grant.
  const consent = await userClient.from('consent_records').select('granted').eq('purpose', 'ai_processing').order('at', { ascending: false }).limit(1).maybeSingle();
  if (consent.error) return fail('INTERNAL_ERROR', 'Could not check consent', 500, traceId);
  if (!consent.data?.granted) return fail('FORBIDDEN', 'AI processing is off for this account', 403, traceId);

  // Reserve first, then count including the reservation: parallel requests see each other.
  const reserved = await admin
    .from('model_runs')
    .insert({ user_id: user.id, purpose, model, prompt_version: promptVersion, schema_valid: false, stop_reason: 'pending' })
    .select('id')
    .single();
  if (reserved.error) {
    console.error(`${purpose}: reserve failed`, traceId, reserved.error.message);
    return fail('INTERNAL_ERROR', 'Could not start', 500, traceId);
  }
  const runId = reserved.data.id as string;
  const update = async (fields: Record<string, unknown>) => {
    const r = await admin.from('model_runs').update(fields).eq('id', runId);
    if (r.error) console.error(`${purpose}: run update failed`, traceId, r.error.message);
  };

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [hour, day] = await Promise.all([
    admin.from('model_runs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', hourAgo).neq('stop_reason', 'rate_limited'),
    // At most 30 calls an hour get here, so a day stays well under the 1,000-row read limit.
    admin.from('model_runs').select('input_tokens, output_tokens').eq('user_id', user.id).gte('created_at', dayAgo).neq('stop_reason', 'rate_limited'),
  ]);
  if (hour.error || day.error) {
    await update({ stop_reason: 'error_limits' });
    return fail('INTERNAL_ERROR', 'Could not check the limits', 500, traceId);
  }
  const tokensToday = (day.data ?? []).reduce((n, r) => n + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);
  if ((hour.count ?? 0) > CALLS_PER_HOUR || tokensToday > TOKENS_PER_DAY) {
    // A refused request leaves no row behind, so refusals cannot pile up.
    const del = await admin.from('model_runs').delete().eq('id', runId);
    if (del.error) await update({ stop_reason: 'rate_limited' });
    return fail('RATE_LIMITED', 'The AI has reached its limit for now; try again later', 429, traceId);
  }

  const started = Date.now();
  return {
    model,
    async done(fields) {
      await update({ ...fields, latency_ms: Date.now() - started });
      const log = await admin.from('security_log').insert({ user_ref: await hashUserId(user.id), event: 'model_call', detail: `${purpose} ${fields.stop_reason}` });
      if (log.error) console.error(`${purpose}: security log failed`, traceId, log.error.message);
    },
  };
}
