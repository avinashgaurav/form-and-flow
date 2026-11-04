import { callAnthropic } from './anthropic.ts';
import { callGemini, type GeminiRequest } from './gemini.ts';
import { fail } from './http.ts';
import { parseProvider, type ModelResult, type Provider } from './provider.ts';
import type { coachRequest } from './requests.ts';

/**
 * The one place the functions choose and call the AI provider (AI_PROVIDER, default gemini). Each
 * function builds both requests from the same prompt, schema and limits and reads the answer in one
 * shape (provider.ts), so consent, limits, validators, fail-closed rules and model_runs logging stay
 * the same whichever provider is set.
 */
export interface AiSetup {
  provider: Provider;
  geminiKey?: string;
}

/** Checked before any run is reserved: a setup mistake calls no AI and leaves no model_runs row. */
export function aiSetup(traceId: string): AiSetup | Response {
  const provider = parseProvider(Deno.env.get('AI_PROVIDER'));
  if (!provider) {
    console.error('ai: AI_PROVIDER must be gemini or anthropic', traceId);
    return fail('INTERNAL_ERROR', 'The AI is not set up', 500, traceId);
  }
  if (provider === 'gemini') {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      console.error('ai: GEMINI_API_KEY is not set', traceId);
      return fail('INTERNAL_ERROR', 'The AI is not set up', 500, traceId);
    }
    return { provider, geminiKey };
  }
  return { provider };
}

export function callModel(
  setup: AiSetup,
  build: { anthropic: () => ReturnType<typeof coachRequest>; gemini: () => GeminiRequest },
  o: { timeoutMs: number; maxRetries: number; timeoutReason?: boolean },
): Promise<ModelResult> {
  return setup.provider === 'gemini'
    ? callGemini(build.gemini(), { apiKey: setup.geminiKey!, timeoutMs: o.timeoutMs, maxRetries: o.maxRetries })
    : callAnthropic(build.anthropic(), { apiKey: Deno.env.get('ANTHROPIC_API_KEY'), ...o });
}
