import { AI_PROVIDER } from './flags';

/**
 * Every AI function reply says which provider answered. The phone uses an answer only if that is the
 * provider its privacy notice names (EXPO_PUBLIC_AI_PROVIDER); otherwise it treats the call as failed:
 * the safety screen then gives the fixed safe reply, the coach answers from its rules, and a photo's
 * food list is not used. The server also refuses a consent given under another provider's notice before any call.
 */
export function providerMatches(reply: { provider?: unknown } | null | undefined, expected: 'gemini' | 'anthropic' = AI_PROVIDER): boolean {
  return !!reply && reply.provider === expected;
}
