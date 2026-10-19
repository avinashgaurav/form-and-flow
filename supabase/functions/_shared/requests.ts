import type Anthropic from '@anthropic-ai/sdk';
import { COACH_OUTPUT_SCHEMA, renderCoachPrompt, type CoachTone } from './coach-prompt.ts';
import { PHOTO_OUTPUT_SCHEMA, PHOTO_SYSTEM } from './photo-prompt.ts';

/**
 * The exact Claude requests the server functions send, in one place, so the smoke test
 * (scripts/ai-smoke.mts) sends the same thing the app does. No Deno APIs: Node can import it.
 */

type Params = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;

/** Server-side fallback on a policy decline; Haiku has none, so it is left out there. */
function fallback(model: string): Pick<Params, 'betas' | 'fallbacks'> {
  return model === 'claude-haiku-5-5' ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
}

export function coachRequest(p: { model: string; tone: CoachTone; facts: Record<string, number | string>; retry: boolean; message: string }): Params {
  return {
    model: p.model,
    // Replies are at most four sentences; this bounds cost and stops use as a general model.
    max_tokens: 1500,
    ...fallback(p.model),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: COACH_OUTPUT_SCHEMA } },
    system: renderCoachPrompt(p.tone, p.facts, p.retry),
    messages: [{ role: 'user', content: p.message }],
  };
}

export function photoRequest(p: { model: string; image: string; media_type: 'image/jpeg' | 'image/png' | 'image/webp' }): Params {
  return {
    model: p.model,
    max_tokens: 1500,
    ...fallback(p.model),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: PHOTO_OUTPUT_SCHEMA } },
    system: PHOTO_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: p.media_type, data: p.image } },
          { type: 'text', text: 'List the foods in this meal photo.' },
        ],
      },
    ],
  };
}
