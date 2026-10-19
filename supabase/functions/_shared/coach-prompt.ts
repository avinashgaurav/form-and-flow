/**
 * The coach system prompt (plan/13 section 1). Pure and import-free on purpose: the server keeps a
 * byte-identical copy at supabase/functions/_shared/coach-prompt.ts, checked by a test, because the
 * server builds the prompt itself and never accepts one from the phone.
 */

export const COACH_PROMPT_VERSION = 'coach-2026-10-19';

/** Evidence card IDs the model may cite. A test keeps this equal to the curated card list. */
export const COACH_CARD_IDS = [
  'ev-activity-who',
  'ev-strength-acsm',
  'ev-protein-range',
  'ev-weight-loss-rate',
  'ev-progression',
  'ev-rest',
  'ev-photo-estimates',
  'ev-supplements',
  'ev-screening',
];

export type CoachTone = 'direct' | 'gentle' | 'data';

/** Models the user may pick for the coach's wording. The server rejects anything else. */
export const COACH_MODELS = [
  { id: 'claude-haiku-5-5', label: 'Fast', note: 'Quickest replies.' },
  { id: 'claude-sonnet-5-5', label: 'Balanced', note: 'Good wording, quick.' },
  { id: 'claude-opus-5-5', label: 'Most capable', note: 'Best wording, a little slower.' },
] as const;

export type CoachModelId = (typeof COACH_MODELS)[number]['id'];

export const DEFAULT_COACH_MODEL: CoachModelId = 'claude-opus-5-5';

export const isCoachModel = (id: unknown): id is CoachModelId => COACH_MODELS.some((m) => m.id === id);

const TONES: Record<CoachTone, string> = { direct: 'short and direct', gentle: 'warm and encouraging', data: 'numbers first, plain' };

/** Longest message the coach accepts, on the phone and on the server. */
export const COACH_MESSAGE_MAX = 500;

export function renderCoachPrompt(tone: CoachTone, facts: Record<string, number | string>, retry = false): string {
  const lines = [
    'You are the Form & Flow fitness coach. You explain a plan that tested code already decided.',
    `Tone: ${TONES[tone]}. Write at most 4 short sentences. No emoji. No em dashes.`,
    'Rules you must follow:',
    '1. Every number you write must appear in FACTS below or in a cited evidence card. Never invent targets, calories, weights or doses.',
    '2. Never diagnose, treat, prescribe medicines or supplements, or tell anyone to train through pain.',
    '3. Only propose actions from this list: swap_exercise {from, to}, shorten_session {minutes}, show_evidence {card_id}.',
    '4. Cite evidence only by these IDs: ' + COACH_CARD_IDS.join(', ') + '.',
    '5. If unsure, say so and suggest one clarifying question.',
    'FACTS: ' + JSON.stringify(facts),
  ];
  if (retry) lines.push('Your last answer broke a rule: a number not in FACTS, an unsafe topic or an action not on the list. Answer again and follow the rules exactly.');
  return lines.join('\n');
}

/** JSON schema for the model's reply (structured outputs). Every object closes its properties. */
export const COACH_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['swap_exercise', 'shorten_session', 'show_evidence'] },
          from: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          to: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          minutes: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
          card_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
        required: ['type', 'from', 'to', 'minutes', 'card_id'],
        additionalProperties: false,
      },
    },
    evidence_card_ids: { type: 'array', items: { type: 'string' } },
  },
  required: ['text', 'actions', 'evidence_card_ids'],
  additionalProperties: false,
} as const;

/** Flat schema output to the engine's action shape: nulls dropped, fields moved into a payload. */
export function toModelOutput(raw: {
  text: string;
  actions: { type: string; from: string | null; to: string | null; minutes: number | null; card_id: string | null }[];
  evidence_card_ids: string[];
}): { text: string; actions: { type: string; payload: Record<string, unknown> }[]; evidence_card_ids: string[] } {
  return {
    text: raw.text,
    actions: raw.actions.map(({ type, ...rest }) => ({
      type,
      payload: Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== null)),
    })),
    evidence_card_ids: raw.evidence_card_ids,
  };
}
