/**
 * Held-out coach eval. Per case and per run:
 *   1. The code-side safety path (coachTurn with a model stub that only counts calls) decides
 *      whether the message is routed to a fixed response: the safety word list first, then the AI
 *      safety screen (the app's exact screenRequest, sent through the CLI) for anything the list
 *      did not catch. The coach model is not involved in this step.
 *   2. Ordinary and temptation cases that are not routed go to the model through the Claude Code
 *      CLI, using the app's exact coachRequest (system prompt, JSON schema, effort).
 *   3. The reply goes through the app's validateModelOutput and the eval's own number check.
 *
 *   node --import tsx evals/coach/run.ts [--runs 3] [--concurrency 4] [--model claude-opus-5-5] [--out results] [--cases cases.jsonl]
 * Raw records go to evals/coach/<out>/run-N.jsonl (default results/); then run score.ts.
 *
 * --provider gemini sends the same steps to Google Gemini instead of the CLI: the server's own Gemini
 * request builders (geminiScreenRequest, geminiCoachRequest) straight to the Gemini API, with the model
 * the server maps the --model choice to (gemini.ts). Needs GEMINI_API_KEY in the environment. The records
 * keep the same fields (the `cli` field then holds the API call), so the score scripts are unchanged.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coachTurn, DEFAULT_COACH_MODEL, SCREEN_MODEL, toModelOutput, validateModelOutput, classifyText } from '../../packages/engines/src/index.ts';
import { geminiCoachRequest, geminiScreenRequest, GEMINI_SCREEN_MODEL } from '../../supabase/functions/_shared/gemini.ts';
import { providerModel } from '../../supabase/functions/_shared/provider.ts';
import { coachRequest, screenRequest } from '../../supabase/functions/_shared/requests.ts';
import { callCli, type CliResult } from './cli.ts';
import { callGeminiEval } from './gemini.ts';
import { wrongNumbers } from './check.ts';
import { contextFor } from './profiles.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

export interface Case {
  id: string;
  category: 'ordinary' | 'temptation' | 'safety';
  profile: string;
  lang: 'en' | 'hinglish';
  message: string;
}

export function loadCases(file = 'cases.jsonl'): Case[] {
  return readFileSync(join(HERE, file), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Case);
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }));
  return out;
}

type Provider = 'cli' | 'gemini';

/** One screen call and one coach call, through the CLI (Claude) or the Gemini API, from the same builders the server uses. */
function callScreen(provider: Provider, message: string, screenModel: string): Promise<CliResult & { attempts?: string[]; screen_decision?: string; stop_reason?: string | null }> {
  return provider === 'gemini' ? callGeminiEval(geminiScreenRequest({ message, model: screenModel }), 'screen') : callCli(screenRequest({ message, model: screenModel }), screenModel);
}
function callCoach(provider: Provider, p: Parameters<typeof coachRequest>[0]): Promise<CliResult & { attempts?: string[]; stop_reason?: string | null }> {
  return provider === 'gemini' ? callGeminiEval(geminiCoachRequest(p), 'coach') : callCli(coachRequest(p), p.model);
}

async function evalCase(c: Case, model: string, screenModel: string, provider: Provider) {
  const { ctx, facts } = contextFor(c.profile);

  // 1. Code path only. The stub throws so a reply can never come from it; we only count calls.
  // The safety screen is real: the app's request, through the CLI. The CLI starts a new process per
  // call, so its time is not the app's; the deadline here is generous and the time is recorded.
  let modelCalls = 0;
  let screen: Record<string, unknown> | null = null;
  const routed = await coachTurn(c.message, ctx, {
    aiAllowed: true,
    model: async () => {
      modelCalls++;
      throw new Error('stub');
    },
    screen: async (message) => {
      const r = await callScreen(provider, message, screenModel);
      screen = { ok: r.ok, answer: r.structured, error: r.error, models: r.models, ms: r.ms, usage: r.usage, cost_usd: r.costUsd, ...(r.attempts ? { attempts: r.attempts, first_attempt: r.screen_decision, stop_reason: r.stop_reason } : {}) };
      if (!r.ok) throw new Error(r.error ?? 'screen failed');
      return r.structured;
    },
    screenTimeoutMs: 180_000,
  });
  const lexicon = classifyText(c.message);
  const route = routed.safety;
  const rec: Record<string, unknown> = {
    id: c.id,
    category: c.category,
    profile: c.profile,
    message: c.message,
    route,
    lexicon: { kind: lexicon.kind, confidence: lexicon.confidence, matched: lexicon.matched },
    fixed_reply: route === 'routine' ? null : routed.text,
    // The AI safety screen's call, or null when the word list caught the message first.
    screen,
    problems: routed.problems,
    // Would the app itself have asked the model? False when a safety template or a rules answer
    // with an action (shorten, swap, show evidence) short-circuits first.
    app_would_call_model: modelCalls > 0,
  };
  if (c.category === 'safety' || route !== 'routine') return rec;

  // 2. The model, through the CLI, with the app's exact request.
  const r = await callCoach(provider, { model, tone: ctx.tone, facts, retry: false, message: c.message });
  rec.cli = { ok: r.ok, error: r.error, models: r.models, ms: r.ms, usage: r.usage, cost_usd: r.costUsd, ...(r.attempts ? { attempts: r.attempts, stop_reason: r.stop_reason } : {}) };
  rec.raw = r.structured;
  if (!r.ok) return rec;

  // 3. The app's validator, then the eval's own check on what would reach the user.
  const v = validateModelOutput(toModelOutput(r.structured as Parameters<typeof toModelOutput>[0]), ctx, facts);
  const wrong = wrongNumbers(v.text, facts, v.cards, ctx.nutritionMode === 'non_numeric');
  rec.validator = { ok: v.ok, problems: v.problems, actions: v.actions.map((a) => a.label) };
  rec.eval_wrong_numbers = wrong;
  rec.outcome = wrong.length ? (v.ok ? 'escaped' : 'caught') : v.ok ? 'clean_pass' : 'rejected_no_wrong_number';
  return rec;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const runs = Number(flag('runs') ?? 3);
  const first = Number(flag('first') ?? 1);
  const conc = Number(flag('concurrency') ?? 4);
  const provider: Provider = flag('provider') === 'gemini' ? 'gemini' : 'cli';
  const choice = flag('model') ?? DEFAULT_COACH_MODEL;
  // With Gemini, --model is one of the app's choices and is mapped the way the server maps it.
  const model = provider === 'gemini' ? providerModel('gemini', choice as typeof DEFAULT_COACH_MODEL) ?? choice : choice;
  const screenModel = flag('screen-model') ?? (provider === 'gemini' ? GEMINI_SCREEN_MODEL : SCREEN_MODEL);
  const out = flag('out') ?? 'results';
  const cases = loadCases(flag('cases') ?? 'cases.jsonl');
  mkdirSync(join(HERE, out), { recursive: true });
  for (let n = first; n < first + runs; n++) {
    const t0 = Date.now();
    const recs = await pool(cases, conc, (c) => evalCase(c, model, screenModel, provider));
    const file = join(HERE, out, `run-${n}.jsonl`);
    writeFileSync(file, recs.map((r) => JSON.stringify({ run: n, ...(provider === 'gemini' ? { provider: 'gemini-api' } : {}), model_requested: model, screen_model_requested: screenModel, ...r })).join('\n') + '\n');
    const failed = recs.filter((r) => r.cli && !(r.cli as { ok: boolean }).ok).length;
    console.log(`run ${n}: ${recs.length} cases in ${Math.round((Date.now() - t0) / 1000)} s, ${failed} ${provider === 'gemini' ? 'coach call' : 'CLI'} failures -> ${out}/run-${n}.jsonl`);
  }
}

if (process.argv[1]?.endsWith('run.ts')) main();
