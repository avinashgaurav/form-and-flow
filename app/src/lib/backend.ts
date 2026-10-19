import { authStorage } from './authStorage';
import { createClient, FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Optional backup and AI server. Without these two variables the app runs fully on the phone, which
 * is how the pilot build ships until a Supabase project exists (see supabase/SETUP.md).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const backendConfigured = !!(url && key);

export const supabase: SupabaseClient | null = backendConfigured
  ? createClient(url!, key!, { auth: { storage: authStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null;

export interface FnError {
  code: string;
  message: string;
}

/** Calls an Edge Function and unwraps the shared error shape (plan/12 section 5.2). */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<{ data?: T; error?: FnError }> {
  if (!supabase) return { error: { code: 'NOT_CONFIGURED', message: 'Backup is not set up in this build' } };
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (!error) return { data: data ?? undefined };
  if (error instanceof FunctionsHttpError) {
    try {
      const parsed = (await error.context.json()) as { error?: FnError };
      if (parsed.error) return { error: parsed.error };
    } catch {
      // fall through to the generic message
    }
  }
  return { error: { code: 'NETWORK', message: 'Could not reach the server' } };
}
