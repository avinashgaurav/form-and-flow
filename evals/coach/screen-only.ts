/**
 * The AI safety screen on its own, with the word list switched off: every case goes straight to the
 * screen (the app's exact screenRequest, through the CLI) and the answer is compared with the key.
 * This shows what the second layer would catch if the word list missed a message.
 *
 *   node --import tsx evals/coach/screen-only.ts --cases cases-new.jsonl --key answer-key-new.json --out results-screen --runs 3
 * Writes evals/coach/<out>/screen-only-run-N.jsonl and prints a summary.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScreenOutput, SCREEN_MODEL } from '../../packages/engines/src/index.ts';
import { screenRequest } from '../../supabase/functions/_shared/requests.ts';
import { callCli } from './cli.ts';
import { loadCases } from './run.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const cases = loadCases(flag('cases') ?? 'cases.jsonl');
const key = JSON.parse(readFileSync(join(HERE, flag('key') ?? 'answer-key.json'), 'utf8')) as { cases: Record<string, { expected_safety: string }> };
const out = flag('out') ?? 'results-screen';
const runs = Number(flag('runs') ?? 3);
const model = flag('screen-model') ?? SCREEN_MODEL;
const EXPECT: Record<string, string> = { crisis: 'crisis', red_flag: 'emergency', ed_signal: 'eating_disorder', routine: 'none' };

async function main() {
  mkdirSync(join(HERE, out), { recursive: true });
  const all: { run: number; id: string; expected: string; got: string; cost: number }[] = [];
  for (let n = 1; n <= runs; n++) {
    const recs = [];
    for (let i = 0; i < cases.length; i += 4) {
      const batch = await Promise.all(
        cases.slice(i, i + 4).map(async (c) => {
          const r = await callCli(screenRequest({ message: c.message, model }), model);
          const got = r.ok ? (parseScreenOutput(r.structured) ?? 'invalid') : 'error';
          const expected = EXPECT[key.cases[c.id]!.expected_safety]!;
          all.push({ run: n, id: c.id, expected, got, cost: r.costUsd ?? 0 });
          return { run: n, id: c.id, category: c.category, message: c.message, expected, got, raw: r.structured, error: r.error, models: r.models, ms: r.ms, cost_usd: r.costUsd };
        }),
      );
      recs.push(...batch);
    }
    writeFileSync(join(HERE, out, `screen-only-run-${n}.jsonl`), recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

const safety = all.filter((r) => r.expected !== 'none');
const routine = all.filter((r) => r.expected === 'none');
console.log(JSON.stringify({
  model,
  calls: all.length,
  safety_sent_to_a_fixed_reply: `${safety.filter((r) => r.got !== 'none').length}/${safety.length}`,
  safety_exact_category: `${safety.filter((r) => r.got === r.expected).length}/${safety.length}`,
  safety_missed: safety.filter((r) => r.got === 'none').map((r) => `${r.run}:${r.id}`),
  routine_over_flagged: `${routine.filter((r) => r.got !== 'none').length}/${routine.length}`,
  over_flagged: routine.filter((r) => r.got !== 'none').map((r) => `${r.run}:${r.id}=${r.got}`),
  cost_usd: Math.round(all.reduce((s, r) => s + r.cost, 0) * 1000) / 1000,
}, null, 2));
}

main();
