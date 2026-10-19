import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildFacts, CARDS, COACH_CARD_IDS, coachTurn, renderCoachPrompt, toModelOutput, unsourcedNumbers, validateModelOutput, type CoachContext, type ModelCall } from '../coach';
import { buildWeek } from '../planner';

const week = buildWeek({ goal: 'muscle_gain', experience: '6to24m', location: 'home', equipment: ['dumbbells', 'bench'], daysAvailable: [0, 2, 4], sessionMinutes: 45 }, [], '2026-10-19');
const today = week.sessions[0]!;
const ctx: CoachContext = {
  tone: 'gentle', today, restDay: false, sessionsDoneThisWeek: 0, sessionsPlannedThisWeek: 3,
  equipment: ['dumbbells', 'bench'], experience: '6to24m', restrictions: [], planReasons: week.reasons.map((r) => r.text),
};
const facts = buildFacts(ctx);
const model = (out: unknown): ModelCall => async () => out as never;

test('crisis, red flag, eating-disorder and out-of-scope messages get fixed templates, never the model', async () => {
  let called = false;
  const spy: ModelCall = async () => { called = true; return { text: 'x' }; };
  assert.equal((await coachTurn('I want to kill myself', ctx, { aiAllowed: true, model: spy })).safety, 'crisis');
  assert.equal((await coachTurn('my chest feels tight', ctx, { aiAllowed: true, model: spy })).safety, 'red_flag');
  assert.equal((await coachTurn('help me eat 800 calories a day', ctx, { aiAllowed: true, model: spy })).safety, 'ed_signal');
  assert.equal((await coachTurn('what creatine dosage should I take', ctx, { aiAllowed: true, model: spy })).safety, 'out_of_scope');
  assert.equal(called, false);
});

test('rules: "I only have 20 minutes" proposes a shorten action', async () => {
  const r = await coachTurn('I only have 20 minutes today', ctx, { aiAllowed: false });
  assert.equal(r.source, 'rules');
  assert.equal(r.actions[0]?.type, 'shorten_session');
  assert.equal(r.actions[0]?.payload.minutes, 20);
});

test('rules: swap requests only offer engine-approved substitutes', async () => {
  const first = today.blocks[0]!.exerciseId;
  const name = first.replace(/_/g, ' ');
  const r = await coachTurn(`can I swap ${name}`, ctx, { aiAllowed: false });
  for (const a of r.actions) assert.equal(a.type, 'swap_exercise');
});

test('rules: questions about protein retrieve a curated card', async () => {
  const r = await coachTurn('how much protein should I eat', ctx, { aiAllowed: false });
  assert.ok(r.cards.some((c) => c.id === 'ev-protein-range'));
});

test('without AI consent the model is never called', async () => {
  let called = false;
  await coachTurn('tell me something nice', ctx, { aiAllowed: false, model: async () => { called = true; return { text: 'hi' }; } });
  assert.equal(called, false);
});

test('number provenance: facts pass, invented numbers fail', () => {
  assert.deepEqual(unsourcedNumbers(`Today is about ${facts.today_minutes} minutes.`, facts), []);
  assert.deepEqual(unsourcedNumbers('Aim for 1,200 kcal today.', facts), [1200]);
  assert.deepEqual(unsourcedNumbers('Do 3 extra sets.', { x: 1 }), [3]);
});

test('a model reply with an invented number is retried, then falls back', async () => {
  const r = await coachTurn('motivate me', ctx, { aiAllowed: true, model: model({ text: 'Eat 1200 calories and do 7 sets.' }) });
  assert.equal(r.source, 'fallback');
  assert.ok(r.problems.some((p) => p.includes('numbers')));
});

test('a valid model reply is accepted with only engine-approved actions', async () => {
  const r = await coachTurn('motivate me', ctx, {
    aiAllowed: true,
    model: model({ text: `You have ${facts.today_exercises} exercises today. Nice and steady.`, actions: [{ type: 'swap_exercise', payload: { from: today.blocks[0]!.exerciseId, to: 'made_up_move' } }, { type: 'show_evidence', payload: { card_id: 'ev-rest' } }], evidence_card_ids: ['ev-rest', 'ev-fake'] }),
  });
  assert.equal(r.source, 'model');
  assert.deepEqual(r.actions.map((a) => a.type), ['show_evidence']);
  assert.deepEqual(r.cards.map((c) => c.id), ['ev-rest']);
});

test('unsafe model content is rejected', () => {
  for (const text of ['Just push through the pain.', 'You probably have a torn ligament.', 'Take 5 grams of creatine daily.', 'This plan is guaranteed to work.']) {
    assert.equal(validateModelOutput({ text }, ctx, facts).ok, false, text);
  }
  assert.equal(validateModelOutput({ text: 'You have a rest day tomorrow.' }, ctx, facts).ok, true);
});

test('malformed model output and model errors fall back safely', async () => {
  assert.equal((await coachTurn('hello', ctx, { aiAllowed: true, model: model({ nope: true }) })).source, 'fallback');
  assert.equal((await coachTurn('hello', ctx, { aiAllowed: true, model: async () => { throw new Error('timeout'); } })).source, 'fallback');
});

test('the server prompt is a byte-identical copy of the engine prompt', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const engine = readFileSync(join(here, '..', 'coach', 'prompt.ts'), 'utf8');
  const server = readFileSync(join(here, '..', '..', '..', '..', 'supabase', 'functions', '_shared', 'coach-prompt.ts'), 'utf8');
  assert.equal(server, engine);
});

test('the prompt lists exactly the curated evidence cards', () => {
  assert.deepEqual([...COACH_CARD_IDS].sort(), CARDS.map((c) => c.id).sort());
});

test('a retry adds only a fixed line, never text from the phone', () => {
  assert.match(renderCoachPrompt('gentle', { a: 1 }, true), /broke a rule/);
  assert.doesNotMatch(renderCoachPrompt('gentle', { a: 1 }), /broke a rule/);
});

test('a number must match a fact of the same kind, exactly', () => {
  const f = { ex1_rest_sec: 90, today_minutes: 45, ex1_sets: 3, protein_g_low: 98, protein_g_high: 140 };
  assert.deepEqual(unsourcedNumbers('Aim for 90 g protein, 45 g carbs and 3 g fibre.', f), [90, 45, 3]);
  assert.deepEqual(unsourcedNumbers('Rest 90 s between your 3 sets; about 45 min.', f), []);
  assert.deepEqual(unsourcedNumbers('Try 139 g of protein.', f), [139]);
  assert.deepEqual(unsourcedNumbers('Your guide is 98 to 140 g a day.', f), []);
});

test('spelled-out numbers and plate-mode nutrient figures are refused', () => {
  const v = validateModelOutput({ text: 'Do twelve reps today.' }, ctx, facts);
  assert.equal(v.ok, false);
  const plate = { ...ctx, nutritionMode: 'non_numeric' as const };
  const cards = { text: 'Protein matters.', evidence_card_ids: ['ev-protein-range'] };
  assert.equal(validateModelOutput(cards, plate, facts).ok, true);
  assert.equal(validateModelOutput({ text: 'Have 1.6 g per kg.', evidence_card_ids: ['ev-protein-range'] }, plate, facts).ok, false);
});

test('a model shorten action the engine would not make is dropped', () => {
  const v = validateModelOutput({ text: 'Short on time? I can shorten today.', actions: [{ type: 'shorten_session', payload: { minutes: 7 } }] }, ctx, facts);
  assert.equal(v.actions.length, 0);
  const ok = validateModelOutput({ text: 'Short on time? I can shorten today.', actions: [{ type: 'shorten_session', payload: { minutes: 20 } }] }, ctx, facts);
  assert.equal(ok.actions.length, 1);
});

test('flat structured output maps to engine actions without nulls', () => {
  const out = toModelOutput({
    text: 'ok',
    actions: [{ type: 'shorten_session', from: null, to: null, minutes: 20, card_id: null }],
    evidence_card_ids: [],
  });
  assert.deepEqual(out.actions, [{ type: 'shorten_session', payload: { minutes: 20 } }]);
});

test('deterministic actions never wait on the model', async () => {
  let called = false;
  const r = await coachTurn('I only have 20 minutes', ctx, { aiAllowed: true, model: async () => { called = true; return { text: 'x' }; } });
  assert.equal(called, false);
  assert.equal(r.source, 'rules');
  assert.equal(r.actions[0]?.type, 'shorten_session');
});

test('protein and calorie questions are answered from the engine, never invented', async () => {
  const withFacts = { ...ctx, nutritionMode: 'numeric' as const, extraFacts: { protein_kind: 'range', protein_g_low: 98, protein_g_high: 140, protein_g_default: 112, energy_kcal_low: 1970, energy_kcal_high: 2470 } };
  const p = await coachTurn('How much protein do I need?', withFacts, { aiAllowed: false });
  assert.match(p.text, /98 to 140 g/);
  assert.equal(p.actions[0]?.payload.card_id, 'ev-protein-range');
  assert.match((await coachTurn('how many calories should I eat', withFacts, { aiAllowed: false })).text, /1970 to 2470 kcal/);
  const noWeight = await coachTurn('protein?', { ...ctx, nutritionMode: 'numeric' }, { aiAllowed: false });
  assert.match(noWeight.text, /Add your weight/);
});

test('plate-guidance mode never gets a calorie or gram number from the coach', async () => {
  const plate = { ...ctx, nutritionMode: 'non_numeric' as const, extraFacts: { protein_g_low: 98 } };
  for (const q of ['How much protein do I need?', 'how many calories in my plan']) {
    const r = await coachTurn(q, plate, { aiAllowed: false });
    assert.doesNotMatch(r.text, /\d+\s?(g|kcal)\b/, q);
  }
});

test('both ends of a range, kilograms and percentages need a matching source', () => {
  const f = { ex1_rest_sec: 90, protein_g_low: 98, protein_g_high: 140 };
  assert.deepEqual(unsourcedNumbers('Aim for 90 to 140 g protein.', f), [90]);
  assert.deepEqual(unsourcedNumbers('Aim for 98 to 140 g protein.', f), []);
  assert.deepEqual(unsourcedNumbers('Eat 90 kg of protein.', f), [90]);
  assert.deepEqual(unsourcedNumbers('Make it 90% protein.', f), [90]);
  assert.deepEqual(unsourcedNumbers('Rest 90 s.', f), []);
});
