import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

/** Shared HTTP helpers for Edge Functions: one error shape everywhere (plan/12 section 5.2). */

export const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'REAUTH_REQUIRED'
  | 'MODEL_DECLINED'
  | 'DEPENDENCY_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

export function fail(code: ErrorCode, message: string, status: number, traceId: string): Response {
  return json({ error: { code, message, trace_id: traceId } }, status);
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

/** The user always comes from the session token, never from the body. */
export async function requireUser(req: Request, traceId: string): Promise<{ user: User; userClient: SupabaseClient } | Response> {
  const header = req.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return fail('UNAUTHENTICATED', 'Sign in first', 401, traceId);
  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser(header.slice('Bearer '.length));
  if (error || !data.user) return fail('UNAUTHENTICATED', 'Sign in again', 401, traceId);
  return { user: data.user, userClient };
}

/** Bypasses row-level security. Only for server-only tables and account deletion. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}
