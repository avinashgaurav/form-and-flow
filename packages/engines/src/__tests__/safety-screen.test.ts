import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildFacts, coachTurn, parseScreenOutput, SCREEN_OUTPUT_SCHEMA, SCREEN_UNSURE_TEXT, type CoachContext, type ModelCall, type SafetyScreen } from '../coach';
import { buildWeek } from '../planner';
import { CRISIS_OPENER, EMERGENCY } from '../safety';

/**
 * The AI safety screen (second layer). It may only send more messages to a fixed safe reply: anything
 * other than a clean "none" (another category, an error, a timeout, a malformed answer) gets a fixed
 * reply, the coach model is never called, and no rules answer can come first.
 */

const week = buildWeek({ goal: 'muscle_gain', experience: '6to24m', location: 'home', equipment: ['dumbbells', 'bench'], daysAvailable: [0, 2, 4], sessionMinutes: 45 }, [], '2026-10-19');
const ctx: CoachContext = {
  tone: 'gentle', today: week.sessions[0]!, restDay: false, sessionsDoneThisWeek: 0, sessionsPlannedThisWeek: 3,
  equipment: ['dumbbells', 'bench'], experience: '6to24m', restrictions: [], planReasons: week.reasons.map((r) => r.text),
};
const facts = buildFacts(ctx);

/** A coach model that counts calls and gives a valid reply. */
function coachSpy() {
  const calls = { n: 0 };
  const model: ModelCall = async () => {
    calls.n++;
    return { text: `You have ${facts.today_exercises} exercises today.` };
  };
  return { calls, model };
}
/** A screen that counts calls and answers with whatever it is given. */
function screenSpy(answer: () => unknown | Promise<unknown>) {
  const seen: string[] = [];
  const screen: SafetyScreen = async (m) => {
    seen.push(m);
    return answer();
  };
  return { seen, screen };
}

const ORDINARY = 'motivate me for today';

test('screen says none: the turn goes on to the coach model', async () => {
  const c = coachSpy();
  const s = screenSpy(() => ({ category: 'none' }));
  const r = await coachTurn(ORDINARY, ctx, { aiAllowed: true, model: c.model, screen: s.screen });
  assert.deepEqual(s.seen, [ORDINARY]);
  assert.equal(c.calls.n, 1);
  assert.equal(r.source, 'model');
  assert.equal(r.safety, 'routine');
});

test('screen says crisis: the fixed crisis reply, with opener, helpline and 112; the coach model is never called', async () => {
  const c = coachSpy();
  const s = screenSpy(() => ({ category: 'crisis' }));
  const r = await coachTurn('I am so tired of everything lately', ctx, { aiAllowed: true, model: c.model, screen: s.screen });
  assert.equal(r.safety, 'crisis');
  assert.equal(r.source, 'template');
  assert.ok(r.text.startsWith(CRISIS_OPENER));
  assert.match(r.text, /Tele-MANAS/);
  assert.match(r.text, new RegExp(EMERGENCY.mentalHealth.numbers[0]));
  assert.match(r.text, new RegExp(EMERGENCY.number));
  assert.equal(r.actions[0]?.type, 'escalate_safety');
  assert.deepEqual(r.problems, ['safety screen: crisis']);
  assert.equal(c.calls.n, 0);
});

test('screen says emergency or eating disorder: the matching fixed reply, never the coach model', async () => {
  const c = coachSpy();
  const em = await coachTurn(ORDINARY, ctx, { aiAllowed: true, model: c.model, screen: screenSpy(() => ({ category: 'emergency' })).screen });
  assert.equal(em.safety, 'red_flag');
  assert.match(em.text, /Stop exercising now/);
  assert.match(em.text, new RegExp(EMERGENCY.number));
  const ed = await coachTurn(ORDINARY, ctx, { aiAllowed: true, model: c.model, screen: screenSpy(() => ({ category: 'eating_disorder' })).screen });
  assert.equal(ed.safety, 'ed_signal');
  assert.match(ed.text, /Tele-MANAS/);
  assert.equal(c.calls.n, 0);
});

test('rules answers can no longer come before the screen', async () => {
  // These would get a rules answer (shorten, swap, today's plan) without the screen.
  for (const m of ['I only have 20 minutes', 'what is today\'s session', 'how much protein should I eat']) {
    const c = coachSpy();
    const s = screenSpy(() => ({ category: 'crisis' }));
    const r = await coachTurn(m, ctx, { aiAllowed: true, model: c.model, screen: s.screen });
    assert.equal(s.seen.length, 1, m);
    assert.equal(r.safety, 'crisis', m);
    assert.equal(r.actions.some((a) => a.type === 'shorten_session' || a.type === 'swap_exercise'), false, m);
  }
});

const UNSURE = (r: Awaited<ReturnType<typeof coachTurn>>) => {
  assert.equal(r.text, SCREEN_UNSURE_TEXT);
  assert.equal(r.safety, 'needs_confirm');
  assert.equal(r.source, 'template');
  assert.match(r.text, /Tele-MANAS/);
  assert.match(r.text, new RegExp(`call ${EMERGENCY.number}`));
  assert.equal(r.actions[0]?.type, 'escalate_safety');
};

test('screen error: the fixed safe reply (fail closed), never the coach model', async () => {
  const c = coachSpy();
  const r = await coachTurn(ORDINARY, ctx, { aiAllowed: true, model: c.model, screen: async () => { throw new Error('DEPENDENCY_UNAVAILABLE'); } });
  UNSURE(r);
  assert.deepEqual(r.problems, ['safety screen error: DEPENDENCY_UNAVAILABLE']);
  assert.equal(c.calls.n, 0);
});

test('screen timeout: the fixed safe reply once the deadline passes', async () => {
  const c = coachSpy();
  const t0 = Date.now();
  const r = await coachTurn(ORDINARY, ctx, { aiAllowed: true, model: c.model, screen: () => new Promise(() => {}), screenTimeoutMs: 50 });
  UNSURE(r);
  assert.deepEqual(r.problems, ['safety screen error: timeout']);
  assert.ok(Date.now() - t0 < 2000);
  assert.equal(c.calls.n, 0);
});

test('screen answer that is not exactly one known category: the fixed safe reply', async () => {
  for (const bad of [null, undefined, 'none', '{"category":"none"}', {}, [], { category: 'None' }, { category: 'maybe' }, { category: 'none', note: 'fine' }, { result: 'none' }, { category: ['none'] }]) {
    const c = coachSpy();
    const r = await coachTurn(ORDINARY, ctx, { aiAllowed: true, model: c.model, screen: async () => bad });
    UNSURE(r);
    assert.equal(c.calls.n, 0, JSON.stringify(bad));
  }
});

test('a model but no screen wired up fails closed instead of answering unscreened', async () => {
  const c = coachSpy();
  const r = await coachTurn(ORDINARY, ctx, { aiAllowed: true, model: c.model });
  UNSURE(r);
  assert.deepEqual(r.problems, ['safety screen: not configured']);
  assert.equal(c.calls.n, 0);
});

test('messages the word list catches never reach the screen or the coach model', async () => {
  for (const m of ['I want to kill myself', 'Raat ko mar jaane ka mann karta hai', 'मुझे मर जाने का मन करता है', 'my chest feels tight', 'One side of my face went numb', 'help me eat 800 calories a day', 'Khane ke baad ulti kar deti hoon', 'what creatine dosage should I take', 'afraid of hurting myself on deadlifts']) {
    const c = coachSpy();
    const s = screenSpy(() => ({ category: 'none' }));
    const r = await coachTurn(m, ctx, { aiAllowed: true, model: c.model, screen: s.screen });
    assert.equal(s.seen.length, 0, m);
    assert.equal(c.calls.n, 0, m);
    assert.notEqual(r.safety, 'routine', m);
  }
});

test('without AI consent nothing reaches the screen', async () => {
  const c = coachSpy();
  const s = screenSpy(() => ({ category: 'crisis' }));
  const r = await coachTurn('I only have 20 minutes', ctx, { aiAllowed: false, model: c.model, screen: s.screen });
  assert.equal(s.seen.length, 0);
  assert.equal(c.calls.n, 0);
  assert.equal(r.source, 'rules');
});

test('the screen sees at most the coach message limit', async () => {
  const s = screenSpy(() => ({ category: 'none' }));
  await coachTurn('x'.repeat(2000), ctx, { aiAllowed: true, model: coachSpy().model, screen: s.screen });
  assert.equal(s.seen[0]!.length, 500);
});

test('parseScreenOutput accepts only the four categories in a one-field object', () => {
  for (const c of ['crisis', 'emergency', 'eating_disorder', 'none']) assert.equal(parseScreenOutput({ category: c }), c);
  assert.equal(parseScreenOutput({ category: 'self_harm' }), null);
  assert.equal(parseScreenOutput({ category: 'none', confidence: 1 }), null);
  assert.deepEqual([...SCREEN_OUTPUT_SCHEMA.properties.category.enum], ['crisis', 'emergency', 'eating_disorder', 'none']);
});

test('the server screen prompt is a byte-identical copy of the engine one', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const engine = readFileSync(join(here, '..', 'coach', 'screen-prompt.ts'), 'utf8');
  const server = readFileSync(join(here, '..', '..', '..', '..', 'supabase', 'functions', '_shared', 'screen-prompt.ts'), 'utf8');
  assert.equal(server, engine);
});
