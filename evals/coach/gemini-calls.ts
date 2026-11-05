/**
 * Call statistics for the Gemini runs (results-gemini/), separate from the scoring: which models Google
 * reported, how many calls failed or needed another attempt, how long the answered attempt took, how many
 * screen calls the app itself would have lost (over its 4 s model limit, or a failed first attempt, which
 * the app does not retry), and the estimated cost. No model calls.
 *
 *   node --import tsx evals/coach/gemini-calls.ts   -> results-gemini/calls.json
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCREEN_MODEL_TIMEOUT_MS } from '../../supabase/functions/_shared/screen-prompt.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, 'results-gemini');

interface Call { ok: boolean; error?: string; models: string[]; ms: number; cost_usd: number | null; attempts?: string[]; first_attempt?: string; usage?: { input: number; output: number } | null }

function stats(calls: Call[], screen: boolean) {
  const ms = calls.filter((c) => c.ok).map((c) => c.ms).sort((a, b) => a - b);
  const q = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
  const out: Record<string, unknown> = {
    calls: calls.length,
    models_reported: Object.fromEntries([...new Set(calls.flatMap((c) => c.models))].map((m) => [m, calls.filter((c) => c.models.includes(m)).length])),
    calls_without_model_report: calls.filter((c) => !c.models.length).length,
    failed_after_all_attempts: calls.filter((c) => !c.ok).map((c) => c.error),
    needed_more_than_one_attempt: calls.filter((c) => (c.attempts?.length ?? 1) > 1).length,
    first_attempt_failures: Object.entries(
      calls.filter((c) => c.attempts && c.attempts[0] !== 'answered').reduce<Record<string, number>>((m, c) => ((m[c.attempts![0]!] = (m[c.attempts![0]!] ?? 0) + 1), m), {}),
    ),
    answered_ms: ms.length ? { min: ms[0], median: q(0.5), p90: q(0.9), max: ms[ms.length - 1] } : null,
    tokens: { input: calls.reduce((s, c) => s + (c.usage?.input ?? 0), 0), output: calls.reduce((s, c) => s + (c.usage?.output ?? 0), 0) },
    estimated_cost_usd: Math.round(calls.reduce((s, c) => s + (c.cost_usd ?? 0), 0) * 10000) / 10000,
  };
  if (screen) {
    out.over_app_model_limit_ms = SCREEN_MODEL_TIMEOUT_MS;
    out.answered_but_over_app_limit = ms.filter((m) => m > SCREEN_MODEL_TIMEOUT_MS).length;
    // The app makes one attempt with a 4 s limit: these calls would have shown the fixed safe reply in the app.
    out.app_would_fail_closed = calls.filter((c) => (c.attempts && c.attempts[0] !== 'answered') || c.ms > SCREEN_MODEL_TIMEOUT_MS || !c.ok).length;
  }
  return out;
}

const summary: Record<string, unknown> = {};
let total = 0;
for (const set of readdirSync(ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
  const read = (re: RegExp) =>
    readdirSync(join(ROOT, set))
      .filter((f) => re.test(f))
      .flatMap((f) => readFileSync(join(ROOT, set, f), 'utf8').trim().split('\n').map((l) => JSON.parse(l)));
  const full = read(/^run-\d+\.jsonl$/);
  const only = read(/^screen-only-run-\d+\.jsonl$/);
  const screen: Call[] = full.filter((r) => r.screen).map((r) => r.screen);
  const coach: Call[] = full.filter((r) => r.cli).map((r) => r.cli);
  const onlyCalls: Call[] = only.map((r) => ({ ok: r.got !== 'error', error: r.error, models: r.models, ms: r.ms, cost_usd: r.cost_usd, attempts: r.attempts, first_attempt: r.first_attempt, usage: r.usage }));
  const s: Record<string, unknown> = { full_pipeline_screen: stats(screen, true), full_pipeline_coach: coach.length ? stats(coach, false) : null };
  if (only.length) s.screen_only = stats(onlyCalls, true);
  for (const c of [...screen, ...coach, ...onlyCalls]) total += c.cost_usd ?? 0;
  summary[set] = s;
}
summary.estimated_cost_usd_all = Math.round(total * 10000) / 10000;
summary.note = 'Costs are estimates: token counts reported by the API times the published paid-tier prices in gemini.ts. The calls ran on the free tier, which is not billed.';
writeFileSync(join(ROOT, 'calls.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
