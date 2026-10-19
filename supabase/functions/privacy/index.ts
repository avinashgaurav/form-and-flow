import { CORS, fail, json, requireUser, serviceClient } from '../_shared/http.ts';
import { hashUserId, lastAuthAt } from '../_shared/validate.ts';

/**
 * POST /privacy (plan/15): { "type": "export" } returns every row this user owns;
 * { "type": "deletion" } erases the account. Deletion needs a fresh email-code sign-in (last 15 minutes).
 * The security log keeps a hashed record for one year (DPDP R-05); everything else cascades.
 */

const TABLES = [
  'profiles', 'consent_records', 'readiness_assessments', 'restrictions', 'safety_events', 'goals', 'plans',
  'plan_changes', 'workout_sessions', 'exercise_sets', 'check_ins', 'progress_entries', 'preferences',
  'meal_logs', 'meal_log_items', 'saved_meals', 'reports', 'privacy_requests',
];
/** Tables keyed by user rather than by an id column. */
const KEYED_BY_USER = new Set(['profiles', 'preferences']);
const PAGE = 1000;
const REAUTH_MS = 15 * 60_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const traceId = crypto.randomUUID();
  if (req.method !== 'POST') return fail('VALIDATION_ERROR', 'Use POST', 405, traceId);
  const auth = await requireUser(req, traceId);
  if (auth instanceof Response) return auth;
  const { user, userClient } = auth;

  let type: unknown;
  try {
    type = (await req.json())?.type;
  } catch {
    return fail('VALIDATION_ERROR', 'Body must be JSON', 400, traceId);
  }
  const admin = serviceClient();
  const userRef = await hashUserId(user.id);

  if (type === 'export') {
    const data: Record<string, unknown[]> = {};
    for (const table of TABLES) {
      const rows: unknown[] = [];
      for (let from = 0; ; from += PAGE) {
        // Read through the user's own client, so row-level security decides what is included.
        // A stable order, so pages never skip or repeat rows.
        const page = await userClient.from(table).select('*').order(KEYED_BY_USER.has(table) ? 'user_id' : 'id').range(from, from + PAGE - 1);
        if (page.error) return fail('INTERNAL_ERROR', `Could not read ${table}`, 500, traceId);
        rows.push(...page.data);
        if (page.data.length < PAGE) break;
      }
      data[table] = rows;
    }
    const rec = await admin.from('privacy_requests').insert({ user_id: user.id, type: 'export', status: 'completed', completed_at: new Date().toISOString() });
    const log = await admin.from('security_log').insert({ user_ref: userRef, event: 'export' });
    if (rec.error || log.error) console.error('privacy: export record failed', traceId, rec.error?.message ?? log.error?.message);
    return json({ exported_at: new Date().toISOString(), app: 'Form & Flow', data, trace_id: traceId });
  }

  if (type === 'deletion') {
    // The token's amr claim records when the user last entered a code; refreshing does not move it.
    const token = (req.headers.get('Authorization') ?? '').slice('Bearer '.length);
    if (Date.now() - lastAuthAt(token) > REAUTH_MS) return fail('REAUTH_REQUIRED', 'Confirm your email code again before deleting', 401, traceId);
    // The security log entry is a legal record (DPDP R-05): no log, no deletion.
    const log = await admin.from('security_log').insert({ user_ref: userRef, event: 'deletion' });
    if (log.error) {
      console.error('privacy: security log failed', traceId, log.error.message);
      return fail('INTERNAL_ERROR', 'Could not start deletion; nothing was deleted', 500, traceId);
    }
    const ledger = await admin.from('deletion_ledger').upsert({ user_id_hash: userRef }, { onConflict: 'user_id_hash' });
    if (ledger.error) {
      console.error('privacy: ledger failed', traceId, ledger.error.message);
      return fail('INTERNAL_ERROR', 'Could not start deletion; nothing was deleted', 500, traceId);
    }
    const del = await admin.auth.admin.deleteUser(user.id);
    if (del.error) {
      console.error('privacy: deleteUser failed', traceId, del.error.message);
      // The account still exists, so it must not stay on the ledger (a restore would erase it).
      await admin.from('deletion_ledger').delete().eq('user_id_hash', userRef);
      return fail('INTERNAL_ERROR', 'Deletion failed; nothing was lost, try again', 500, traceId);
    }
    return json({ deleted: true, trace_id: traceId });
  }

  return fail('VALIDATION_ERROR', 'type must be export or deletion', 400, traceId);
});
