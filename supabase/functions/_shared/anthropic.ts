import Anthropic from '@anthropic-ai/sdk';
import type { ModelResult } from './provider.ts';
import type { coachRequest } from './requests.ts';

type Params = ReturnType<typeof coachRequest>;

/**
 * The Anthropic path, unchanged in behaviour: the same SDK call, timeouts and retries the functions made
 * before the provider switch, and the same stop reasons on failure. The client is created on first use,
 * so a Gemini deployment never needs ANTHROPIC_API_KEY.
 */
const clients = new Map<string, Anthropic>();

export async function callAnthropic(
  params: Params,
  o: { apiKey: string | undefined; timeoutMs: number; maxRetries: number; /** Only the safety screen logged timeouts separately. */ timeoutReason?: boolean },
): Promise<ModelResult> {
  const id = `${o.timeoutMs}/${o.maxRetries}`;
  let client = clients.get(id);
  try {
    if (!client) clients.set(id, (client = new Anthropic({ apiKey: o.apiKey, timeout: o.timeoutMs, maxRetries: o.maxRetries })));
    const r = await client.beta.messages.create(params);
    const block = r.content.find((b) => b.type === 'text');
    return {
      ok: true,
      reply: {
        model: r.model,
        input_tokens: r.usage.input_tokens,
        output_tokens: r.usage.output_tokens,
        stop_reason: r.stop_reason ?? 'unknown',
        text: block && block.type === 'text' ? block.text : null,
      },
    };
  } catch (e) {
    const reason =
      o.timeoutReason && e instanceof Anthropic.APIConnectionTimeoutError
        ? 'provider_timeout'
        : e instanceof Anthropic.RateLimitError
          ? 'provider_rate_limited'
          : e instanceof Anthropic.APIError
            ? `provider_error_${e.status ?? 'unknown'}`
            : 'provider_unreachable';
    return { ok: false, reason };
  }
}
