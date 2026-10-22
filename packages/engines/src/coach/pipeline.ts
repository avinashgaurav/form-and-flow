import { shortenSession, substitutes } from '../adjust';
import { getExercise } from '../exercises';
import { classifyText, EMERGENCY } from '../safety';
import type { Equipment, Experience, PlannedSession, Restriction } from '../types';
import { findCards, getCard, type EvidenceCard } from './cards';
import { COACH_MESSAGE_MAX, renderCoachPrompt, type CoachTone } from './prompt';

/**
 * Coach turn pipeline (plan/13 section 1). Engines decide; the model may only phrase and propose.
 *
 *   message -> safety lexicon -> (template | rules | model) -> validators -> reply
 *
 * The one rule: every number in the reply must appear in the facts the context supplied
 * (number provenance). The model never sees or changes another user's data and has no tools.
 */

export type ActionType =
  | 'swap_exercise'
  | 'shorten_session'
  | 'reschedule_session'
  | 'log_meal_draft'
  | 'update_preference'
  | 'propose_plan_change'
  | 'show_evidence'
  | 'escalate_safety';

/** A1 needs no confirmation, A2 needs the user to confirm, A3 is safety (plan/13 section 2). */
export const ACTION_TIER: Record<ActionType, 'A1' | 'A2' | 'A3'> = {
  show_evidence: 'A1',
  log_meal_draft: 'A1',
  swap_exercise: 'A2',
  shorten_session: 'A2',
  reschedule_session: 'A2',
  update_preference: 'A2',
  propose_plan_change: 'A2',
  escalate_safety: 'A3',
};

export interface CoachAction {
  type: ActionType;
  payload: Record<string, unknown>;
  label: string;
}

export interface CoachContext {
  tone: 'direct' | 'gentle' | 'data';
  today?: PlannedSession;
  restDay: boolean;
  sessionsDoneThisWeek: number;
  sessionsPlannedThisWeek: number;
  equipment: Equipment[];
  experience: Experience;
  restrictions: Restriction[];
  planReasons: string[];
  /** Extra facts the reply may mention, e.g. targets from the nutrition engine. */
  extraFacts?: Record<string, number | string>;
  /** Plate guidance hides every calorie and gram number (FD-01). */
  nutritionMode?: 'numeric' | 'non_numeric';
}

export interface CoachReply {
  text: string;
  actions: CoachAction[];
  cards: EvidenceCard[];
  safety: 'routine' | 'red_flag' | 'crisis' | 'ed_signal' | 'out_of_scope' | 'needs_confirm';
  source: 'template' | 'rules' | 'model' | 'fallback';
  problems: string[];
}

/** The model's raw structured output (validated, never trusted). */
export interface ModelOutput {
  text: string;
  actions?: { type: string; payload?: Record<string, unknown> }[];
  evidence_card_ids?: string[];
}

/**
 * `system` is the full prompt for a direct call. A server-backed call sends only `tone`, `facts`
 * and `retry`; the server renders the same prompt from its own copy (coach/prompt.ts).
 */
export type ModelCall = (req: {
  system: string;
  user: string;
  facts: Record<string, number | string>;
  tone: CoachTone;
  /** True on the one retry after a rejected answer. Only a fixed line is added, never the problem text. */
  retry: boolean;
}) => Promise<ModelOutput>;

/* ---------- Facts ---------- */

export function buildFacts(ctx: CoachContext): Record<string, number | string> {
  const f: Record<string, number | string> = {
    sessions_done_this_week: ctx.sessionsDoneThisWeek,
    sessions_planned_this_week: ctx.sessionsPlannedThisWeek,
  };
  if (ctx.today) {
    f.today_session = ctx.today.title;
    f.today_minutes = ctx.today.estimatedMinutes;
    f.today_exercises = ctx.today.blocks.length;
    ctx.today.blocks.forEach((b, i) => {
      f[`ex${i + 1}`] = getExercise(b.exerciseId)?.name ?? b.exerciseId;
      f[`ex${i + 1}_sets`] = b.sets;
      f[`ex${i + 1}_rep_min`] = b.repMin;
      f[`ex${i + 1}_rep_max`] = b.repMax;
      f[`ex${i + 1}_rest_sec`] = b.restSec;
      f[`ex${i + 1}_rir`] = b.targetRir;
    });
  }
  for (const [k, v] of Object.entries(ctx.extraFacts ?? {})) f[k] = v;
  return f;
}

export function numbersIn(text: string): number[] {
  return (text.replace(/,(?=\d{3})/g, '').match(/\d+(\.\d+)?/g) ?? []).map(Number);
}

/** A number followed by one of these words must match a fact of the same kind, not just the same value. */
const UNIT_KINDS: { word: RegExp; key: RegExp }[] = [
  { word: /^(g|gm|gms|grams?)$/i, key: /^protein_g_/ },
  { word: /^(kcal|cal|cals|calories?)$/i, key: /^energy_kcal_/ },
  { word: /^(min|mins|minutes?)$/i, key: /minutes$/ },
  { word: /^sets?$/i, key: /_sets$/ },
  { word: /^reps?$/i, key: /_rep_(min|max)$/ },
  { word: /^rir$/i, key: /_rir$/ },
  { word: /^(s|sec|secs|seconds?)$/i, key: /_rest_sec$/ },
  { word: /^sessions?$/i, key: /^sessions_/ },
  { word: /^exercises?$/i, key: /^today_exercises$/ },
  // No fact is ever in these units, so a number with them must come from a cited card.
  { word: /^(kg|kgs|kilos?|kilograms?|percent|per|pct)$/i, key: /^$/ },
];

/** Spelled-out numbers dodge the digit check, so anything from three upwards is refused outright. */
const NUMBER_WORDS = /\b(three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|lakh|dozen)\b/i;

/** "2 reps in reserve", "2 reps left in the tank": the number is the RIR figure, not a rep count. */
const RIR_AFTER_REPS = /^\s+(?:still\s+|more\s+)?(?:left\s+)?(?:in reserve|in the tank|to spare|short of failure|left|baaki|bache|bachi)\b/i;
const RIR_KIND = UNIT_KINDS.find((u) => u.word.test('rir'))!;

/** Each number in the text with the kind of unit that follows it, if any. */
function figures(text: string): { n: number; kind?: (typeof UNIT_KINDS)[number] }[] {
  // A range takes the unit after it for both ends: "90 to 140 g" is two gram figures.
  const clean = text.replace(/,(?=\d{3})/g, '').replace(/%/g, ' percent');
  const ranged = clean.replace(/(\d+(?:\.\d+)?)(\s*(?:to|-|–)\s*)(\d+(?:\.\d+)?)\s*([A-Za-z]+)/g, '$1 $4$2$3 $4');
  return [...ranged.matchAll(/(\d+(?:\.\d+)?)\s*([A-Za-z]+)?/g)].map((m) => {
    let kind = m[2] ? UNIT_KINDS.find((u) => u.word.test(m[2]!)) : undefined;
    if (m[2] && /^reps?$/i.test(m[2]) && RIR_AFTER_REPS.test(ranged.slice(m.index! + m[0].length))) kind = RIR_KIND;
    return { n: Number(m[1]), kind };
  });
}

/**
 * Number provenance: every number in the text must equal a fact exactly. When a unit follows the
 * number ("90 g", "45 min"), the fact must also be of that kind, so a rest time cannot pass as grams.
 * Numbers in a cited evidence card are allowed as written there: with a unit, only in the same kind
 * of unit, so the protein card's "2.0 g" cannot vouch for "2 kg".
 */
export function unsourcedNumbers(text: string, facts: Record<string, number | string>, cards: EvidenceCard[] = []): number[] {
  const numeric = Object.entries(facts).filter((e): e is [string, number] => typeof e[1] === 'number');
  const fromCards = cards.flatMap((c) => figures(c.summary));
  const out: number[] = [];
  for (const { n, kind } of figures(text)) {
    const pool = kind ? numeric.filter(([k]) => kind.key.test(k)).map(([, v]) => v) : numeric.map(([, v]) => v);
    const onCard = fromCards.some((c) => c.n === n && (!kind || c.kind === kind));
    if (!pool.includes(n) && !onCard) out.push(n);
  }
  return out;
}

/** In plate-guidance mode no reply may carry a calorie or gram figure, whatever its source. */
const NUTRIENT_FIGURE = /\d[\d,.]*\s*(g|gm|gms|grams?|kcal|cal|cals|calories?)\b/i;

const BANNED: RegExp[] = [
  /push through (the )?pain/i,
  /no pain,? no gain/i,
  /\bdiagnos(e|is|ed)\b/i,
  /\byou (probably |likely |may |might )?have (a |an )?(tear|torn|injury|condition|disease|disorder|tendinitis|tendonitis|sprain|strain|fracture|hernia)\b/i,
  /\b(\d+\s?(mg|mcg|iu)|grams? of creatine|scoop)\b/i,
  /\bcure[sd]?\b|\btreat(s|ment)? (your|the) /i,
  /\b(guarantee[sd]?|guaranteed)\b/i,
  /\b(fast|fasting) for (2|3|4|5|6|7) days\b/i,
];

/* ---------- Validation ---------- */

export interface ValidationResult {
  ok: boolean;
  text: string;
  actions: CoachAction[];
  cards: EvidenceCard[];
  problems: string[];
}

export function validateModelOutput(out: unknown, ctx: CoachContext, facts: Record<string, number | string>): ValidationResult {
  const problems: string[] = [];
  const o = out as Partial<ModelOutput> | null;
  if (!o || typeof o !== 'object' || typeof o.text !== 'string' || o.text.trim().length === 0) {
    return { ok: false, text: '', actions: [], cards: [], problems: ['schema: missing text'] };
  }
  const text = o.text.trim().slice(0, 1200);

  const cards = (Array.isArray(o.evidence_card_ids) ? o.evidence_card_ids : [])
    .map((id) => (typeof id === 'string' ? getCard(id) : undefined))
    .filter((c): c is EvidenceCard => {
      if (!c) problems.push('citation: unknown card dropped');
      return !!c;
    });

  const actions: CoachAction[] = [];
  for (const a of Array.isArray(o.actions) ? o.actions : []) {
    const checked = checkAction(a, ctx);
    if (checked) actions.push(checked);
    else problems.push(`action rejected: ${String(a?.type)}`);
  }

  const unsourced = unsourcedNumbers(text, facts, cards);
  if (unsourced.length) problems.push(`numbers without a source: ${unsourced.join(', ')}`);
  if (NUMBER_WORDS.test(text)) problems.push('numbers without a source: spelled-out number');
  if (ctx.nutritionMode === 'non_numeric' && NUTRIENT_FIGURE.test(text)) problems.push('numbers without a source: nutrient figure in plate-guidance mode');
  for (const b of BANNED) if (b.test(text)) problems.push(`unsafe content: ${b.source}`);
  if (classifyText(text).kind === 'out_of_scope') problems.push('unsafe content: out of scope');

  const blocking = problems.filter((p) => p.startsWith('numbers') || p.startsWith('unsafe') || p.startsWith('schema'));
  return { ok: blocking.length === 0, text, actions, cards, problems };
}

/** Engine re-check: an action survives only if the engines would produce it themselves. */
function checkAction(a: { type?: string; payload?: Record<string, unknown> } | undefined, ctx: CoachContext): CoachAction | null {
  if (!a || typeof a.type !== 'string' || !(a.type in ACTION_TIER)) return null;
  const p = a.payload ?? {};
  switch (a.type as ActionType) {
    case 'swap_exercise': {
      const from = String(p.from ?? '');
      const to = String(p.to ?? '');
      const ok = substitutes(from, { equipment: ctx.equipment, restrictions: ctx.restrictions, experience: ctx.experience }).some((e) => e.id === to);
      return ok ? { type: 'swap_exercise', payload: { from, to }, label: `Swap ${getExercise(from)?.name} for ${getExercise(to)?.name}` } : null;
    }
    case 'shorten_session': {
      const minutes = Number(p.minutes);
      // Only if the engine itself would shorten to that length (under 10 minutes it offers something else).
      if (!ctx.today || !Number.isFinite(minutes) || minutes > 120 || shortenSession(ctx.today, minutes).kind !== 'session') return null;
      return { type: 'shorten_session', payload: { minutes }, label: `Shorten today to ${minutes} min` };
    }
    case 'show_evidence': {
      const card = getCard(String(p.card_id ?? ''));
      return card ? { type: 'show_evidence', payload: { card_id: card.id }, label: `Read: ${card.title}` } : null;
    }
    default:
      // Other action types are allowed in the schema but not yet supported by this build.
      return null;
  }
}

/* ---------- Rules (no model needed) ---------- */

const MINUTES = /(\d{1,3})\s?(min|mins|minutes|minute)\b/i;

function ruleReply(message: string, ctx: CoachContext): CoachReply | null {
  const m = message.toLowerCase();
  const facts = buildFacts(ctx);

  const mins = message.match(MINUTES);
  if (mins && /(only|have|got|just|bas|sirf)/i.test(m)) {
    const minutes = Number(mins[1]);
    if (!ctx.today) return reply(ctx.restDay ? 'Today is a rest day, so there is nothing to shorten. Rest is part of the plan.' : 'You have already finished today’s session. Nice work.', [], 'rules');
    const r = shortenSession(ctx.today, minutes);
    if (r.kind === 'alternative') return reply('Under 10 minutes, a short mobility routine or a walk is the better choice today.', [], 'rules');
    return reply(
      `I can fit today's session into ${minutes} minutes. It keeps your warm-up and main lift, and nothing gets harder.`,
      [{ type: 'shorten_session', payload: { minutes }, label: `Shorten today to ${minutes} min` }],
      'rules',
    );
  }

  if (/(swap|replace|instead of|can'?t do|cannot do|don'?t have|no )/i.test(m) && ctx.today) {
    const block = ctx.today.blocks.find((b) => {
      const ex = getExercise(b.exerciseId);
      return ex && [ex.name, ...ex.aliases].some((n) => m.includes(n.toLowerCase().split(' ')[0]!));
    });
    if (block) {
      const subs = substitutes(block.exerciseId, { equipment: ctx.equipment, restrictions: ctx.restrictions, experience: ctx.experience });
      const name = getExercise(block.exerciseId)?.name;
      if (subs.length === 0) return reply(`No safe alternative to ${name} fits your equipment and limits. You can skip it today.`, [], 'rules');
      return reply(
        `Here ${subs.length === 1 ? 'is an alternative' : 'are alternatives'} to ${name} that fit your equipment and limits.`,
        subs.map((s) => ({ type: 'swap_exercise' as const, payload: { from: block.exerciseId, to: s.id }, label: `Swap to ${s.name}` })),
        'rules',
      );
    }
  }

  if (/(what|which).*(today|session)|today'?s (plan|workout|session)/i.test(m)) {
    if (!ctx.today) return reply(`${ctx.restDay ? 'Today is a rest day.' : 'You have finished today’s session.'} You have done ${facts.sessions_done_this_week} of ${facts.sessions_planned_this_week} sessions this week.`, [], 'rules');
    const list = ctx.today.blocks.map((b) => getExercise(b.exerciseId)?.name ?? b.exerciseId).join(', ');
    return reply(`Today is ${ctx.today.title}, about ${ctx.today.estimatedMinutes} minutes: ${list}.`, [], 'rules');
  }

  if (/\bwhy\b/.test(m) && ctx.planReasons.length) {
    return reply(`Your week is built from simple rules: ${ctx.planReasons.join('; ')}.`, [], 'rules');
  }

  if (/\bprotein\b/i.test(m)) {
    const card = getCard('ev-protein-range');
    const read = card ? [{ type: 'show_evidence' as const, payload: { card_id: card.id }, label: `Read: ${card.title}` }] : [];
    const src = card ? [card] : [];
    if (ctx.nutritionMode === 'non_numeric') return reply('Have a protein food at each meal: about a katori of dal, chole or curd, or a palm-sized portion of paneer, eggs, fish or chicken.', read, 'rules', src);
    const { protein_kind: kind, protein_g_low: low, protein_g_high: high, protein_g_default: def } = facts;
    if (kind === 'range' && low !== undefined && high !== undefined) return reply(`Your protein guide is ${low} to ${high} g a day, worked out from your weight and goal. Spread it across your meals.`, read, 'rules', src);
    if (kind === 'floor' && def !== undefined) return reply(`Aim for at least ${def} g of protein a day, worked out from your weight and goal.`, read, 'rules', src);
    if (kind === 'cap' && high !== undefined) return reply(`Because of your safety answers, your plan keeps protein at no more than ${high} g a day. Ask your doctor before changing that.`, read, 'rules', src);
    return reply('Add your weight in Food settings and I can give you a protein range. Until then, have a protein food at each meal.', read, 'rules', src);
  }

  if (/\b(calorie|calories|kcal)\b/i.test(m)) {
    if (ctx.nutritionMode === 'non_numeric') return reply('You are using plate guidance, so I do not show calorie numbers. Fill half the plate with vegetables, a quarter with protein and a quarter with grains.', [], 'rules');
    const { energy_kcal_low: low, energy_kcal_high: high } = facts;
    if (low !== undefined && high !== undefined) return reply(`Your energy guide is ${low} to ${high} kcal a day. It is an estimate from your height, weight, age and activity, so treat it as a range.`, [], 'rules');
    return reply('Add your height and weight in Food settings and I can give you an energy range. We do not guess them.', [], 'rules');
  }

  const cards = findCards(message);
  if (cards.length) {
    return reply(cards[0]!.summary, cards.map((c) => ({ type: 'show_evidence' as const, payload: { card_id: c.id }, label: `Read: ${c.title}` })), 'rules', cards);
  }
  return null;
}

function reply(text: string, actions: CoachAction[], source: CoachReply['source'], cards: EvidenceCard[] = [], safety: CoachReply['safety'] = 'routine'): CoachReply {
  return { text, actions, cards, safety, source, problems: [] };
}

const FALLBACK =
  'I can help with today’s session, shortening it, swapping an exercise, why your plan looks the way it does, and the basics of training and food. Try "I only have 20 minutes" or "swap squats".';

/* ---------- Turn ---------- */

export function systemPrompt(ctx: CoachContext, facts: Record<string, number | string>, retry = false): string {
  return renderCoachPrompt(ctx.tone, facts, retry);
}

export async function coachTurn(message: string, ctx: CoachContext, opts: { aiAllowed: boolean; model?: ModelCall }): Promise<CoachReply> {
  const safety = classifyText(message);
  if (safety.kind === 'crisis') {
    if (safety.confidence === 'needs_confirm') {
      return reply(`Just to check: do you mean an injury from training, or thoughts of harming yourself? If it is the second, please talk to someone now. Tele-MANAS is free and open 24 hours: ${EMERGENCY.mentalHealth.numbers[0]}.`, [{ type: 'escalate_safety', payload: { kind: 'crisis' }, label: 'Get help now' }], 'template', [], 'needs_confirm');
    }
    return reply(`Please talk to someone now. Tele-MANAS is free and open 24 hours: ${EMERGENCY.mentalHealth.numbers[0]}. If you are in danger, call ${EMERGENCY.number}.`, [{ type: 'escalate_safety', payload: { kind: 'crisis' }, label: 'Get help now' }], 'template', [], 'crisis');
  }
  if (safety.kind === 'red_flag') {
    if (safety.confidence === 'needs_confirm') return reply('Just to check: are you having chest pain, fainting, severe breathlessness or one-sided weakness right now?', [], 'template', [], 'needs_confirm');
    return reply(`Stop exercising now. If this is happening now, call ${EMERGENCY.number}.`, [{ type: 'escalate_safety', payload: { kind: 'red_flag' }, label: 'Emergency guidance' }], 'template', [], 'red_flag');
  }
  if (safety.kind === 'ed_signal') {
    return reply('I will not set a very low calorie target, because it can harm your health. If food feels hard right now, you can turn off calorie numbers in Settings, and Tele-MANAS (14416) is free to talk to.', [], 'template', [], 'ed_signal');
  }
  if (safety.kind === 'out_of_scope') {
    const card = getCard('ev-supplements')!;
    return reply('That needs a doctor or registered dietitian, so I will not advise on it. I can help with your training and everyday food.', [{ type: 'show_evidence', payload: { card_id: card.id }, label: `Read: ${card.title}` }], 'template', [card], 'out_of_scope');
  }

  const rules = ruleReply(message, ctx);
  // Deterministic flows that propose an action (shorten, swap) never depend on the model.
  if (rules && rules.actions.length) return rules;
  if (!opts.aiAllowed || !opts.model) return rules ?? reply(FALLBACK, [], 'fallback');

  const facts = buildFacts(ctx);
  const user = message.slice(0, COACH_MESSAGE_MAX);
  const problems: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const retry = attempt > 0;
      const out = await opts.model({ system: systemPrompt(ctx, facts, retry), user, facts, tone: ctx.tone, retry });
      const v = validateModelOutput(out, ctx, facts);
      if (v.ok) return { text: v.text, actions: v.actions, cards: v.cards, safety: 'routine', source: 'model', problems: v.problems };
      problems.push(...v.problems);
    } catch (e) {
      problems.push(`model error: ${(e as Error).message}`);
      break;
    }
  }
  const fb = rules ?? reply(FALLBACK, [], 'fallback');
  return { ...fb, source: 'fallback', problems };
}
