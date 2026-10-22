/**
 * Held-out coach eval. Per case and per run:
 *   1. The code-side safety path (coachTurn with a model stub that only counts calls) decides
 *      whether the message is routed to a fixed response. No model is involved.
 *   2. Ordinary and temptation cases that are not routed go to the model through the Claude Code
 *      CLI, using the app's exact coachRequest (system prompt, JSON schema, effort).
 *   3. The reply goes through the app's validateModelOutput and the eval's own number check.
 *
 *   node --import tsx evals/coach/run.ts [--runs 3] [--concurrency 4] [--model claude-opus-5-5] [--out results]
 * Raw records go to evals/coach/<out>/run-N.jsonl (default results/); then run score.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coachTurn, DEFAULT_COACH_MODEL, toModelOutput, validateModelOutput, classifyText } from '../../packages/engines/src/index.ts';
import { coachRequest } from '../../supabase/functions/_shared/requests.ts';
import { callCli } from './cli.ts';
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

export function loadCases(): Case[] {
  return readFileSync(join(HERE, 'cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Case);
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

async function evalCase(c: Case, model: string) {
  const { ctx, facts } = contextFor(c.profile);

  // 1. Code path only. The stub throws so a reply can never come from it; we only count calls.
  let modelCalls = 0;
  const routed = await coachTurn(c.message, ctx, {
    aiAllowed: true,
    model: async () => {
      modelCalls++;
      throw new Error('stub');
    },
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
    // Would the app itself have asked the model? False when a safety template or a rules answer
    // with an action (shorten, swap, show evidence) short-circuits first.
    app_would_call_model: modelCalls > 0,
  };
  if (c.category === 'safety' || route !== 'routine') return rec;

  // 2. The model, through the CLI, with the app's exact request.
  const req = coachRequest({ model, tone: ctx.tone, facts, retry: false, message: c.message });
  const r = await callCli(req, model);
  rec.cli = { ok: r.ok, error: r.error, models: r.models, ms: r.ms, usage: r.usage, cost_usd: r.costUsd };
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
  const model = flag('model') ?? DEFAULT_COACH_MODEL;
  const out = flag('out') ?? 'results';
  const cases = loadCases();
  mkdirSync(join(HERE, out), { recursive: true });
  for (let n = first; n < first + runs; n++) {
    const t0 = Date.now();
    const recs = await pool(cases, conc, (c) => evalCase(c, model));
    const file = join(HERE, out, `run-${n}.jsonl`);
    writeFileSync(file, recs.map((r) => JSON.stringify({ run: n, model_requested: model, ...r })).join('\n') + '\n');
    const failed = recs.filter((r) => r.cli && !(r.cli as { ok: boolean }).ok).length;
    console.log(`run ${n}: ${recs.length} cases in ${Math.round((Date.now() - t0) / 1000)} s, ${failed} CLI failures -> ${out}/run-${n}.jsonl`);
  }
}

if (process.argv[1]?.endsWith('run.ts')) main();
