/**
 * Real-AI smoke test: sends the app's exact coach and photo requests to Claude and runs the
 * replies through the same checks the phone uses. Costs a few cents. Run it yourself, with your
 * own key in your own terminal (never paste the key into a chat):
 *
 *   export ANTHROPIC_API_KEY=...            (from platform.claude.com)
 *   npm run ai:smoke
 *   npm run ai:smoke -- --model claude-haiku-5-5 --photo ~/Pictures/thali.jpg
 */
import Anthropic from '@anthropic-ai/sdk';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import {
  buildFacts,
  buildWeek,
  COACH_MODELS,
  DEFAULT_COACH_MODEL,
  draftToLogItem,
  isCoachModel,
  itemTotals,
  photoItemsToDrafts,
  roundEstimate,
  toModelOutput,
  toPhotoOutput,
  validateModelOutput,
  type CoachContext,
} from '../packages/engines/src/index.ts';
import { coachRequest, photoRequest } from '../supabase/functions/_shared/requests.ts';
import { parsePhotoBody } from '../supabase/functions/_shared/validate.ts';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const model = flag('model') ?? DEFAULT_COACH_MODEL;
  const photoPath = flag('photo');
  if (!isCoachModel(model)) {
    console.error(`--model must be one of: ${COACH_MODELS.map((m) => m.id).join(', ')}`);
    return 2;
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Set ANTHROPIC_API_KEY in this terminal first (see the top of scripts/ai-smoke.ts).');
    return 2;
  }

  // Prices per million tokens (input, output), as published for these models.
  const PRICE: Record<string, [number, number]> = { 'claude-haiku-5-5': [0.1, 0.5], 'claude-sonnet-5-5': [2, 10], 'claude-opus-5-5': [4, 20] };
  const anthropic = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  let inTok = 0;
  let outTok = 0;
  let failures = 0;

  async function call(params: Anthropic.Beta.Messages.MessageCreateParamsNonStreaming) {
    const r = await anthropic.beta.messages.create(params);
    inTok += r.usage.input_tokens;
    outTok += r.usage.output_tokens;
    const block = r.content.find((b) => b.type === 'text');
    if (r.stop_reason !== 'end_turn' || !block || block.type !== 'text') throw new Error(`stop_reason ${r.stop_reason}`);
    return { json: JSON.parse(block.text) as unknown, served: r.model };
  }

  /* ---------- Coach ---------- */

  const week = buildWeek({ goal: 'muscle_gain', experience: '6to24m', location: 'home', equipment: ['dumbbells', 'bench'], daysAvailable: [0, 2, 4], sessionMinutes: 45 }, [], '2026-10-19');
  const ctx: CoachContext = {
    tone: 'gentle',
    today: week.sessions[0],
    restDay: false,
    sessionsDoneThisWeek: 1,
    sessionsPlannedThisWeek: 3,
    equipment: ['dumbbells', 'bench'],
    experience: '6to24m',
    restrictions: [],
    planReasons: week.reasons.map((r) => r.text),
    nutritionMode: 'numeric',
    extraFacts: { energy_kcal_low: 1970, energy_kcal_high: 2470, protein_kind: 'range', protein_g_low: 98, protein_g_default: 112, protein_g_high: 140 },
  };
  const facts = buildFacts(ctx);
  const MESSAGES = [
    'Motivate me for today’s session',
    'What should I focus on today?',
    'Aaj thoda thaka hua hoon, kya karun?',
    'Explain my protein guide simply',
    'Can I swap the first exercise for something easier?',
  ];

  console.log(`Model: ${model}\n`);
  console.log('Coach replies (checked with the phone’s own validator):');
  for (const message of MESSAGES) {
    try {
      const { json, served } = await call(coachRequest({ model, tone: ctx.tone, facts, retry: false, message }));
      const v = validateModelOutput(toModelOutput(json as Parameters<typeof toModelOutput>[0]), ctx, facts);
      console.log(`\n${v.ok ? 'PASS' : 'REJECTED (the app would retry, then answer from rules)'}  "${message}"${served !== model ? `  [served by ${served}]` : ''}`);
      console.log(`  ${v.text}`);
      if (v.actions.length) console.log(`  actions: ${v.actions.map((a) => a.label).join('; ')}`);
      if (v.problems.length) console.log(`  notes: ${v.problems.join('; ')}`);
    } catch (e) {
      failures++;
      console.log(`\nFAIL  "${message}": ${(e as Error).message}`);
    }
  }

  /* ---------- Photo ---------- */

  if (photoPath) {
    console.log('\nMeal photo:');
    try {
      const ext = extname(photoPath).toLowerCase();
      let image = readFileSync(photoPath).toString('base64');
      let media = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      // The phone shrinks photos to about 1,000 px JPEG first. On a Mac, do the same with sips, which
      // also converts iPhone HEIC photos.
      if ((image.length > 1_000_000 || !['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) && process.platform === 'darwin') {
        const small = join(mkdtempSync(join(tmpdir(), 'ff-photo-')), 'small.jpg');
        execFileSync('sips', ['-Z', '1024', '-s', 'format', 'jpeg', photoPath, '--out', small], { stdio: 'ignore' });
        image = readFileSync(small).toString('base64');
        media = 'image/jpeg';
      }
      const body = parsePhotoBody({ image, media_type: media });
      if (typeof body === 'string') throw new Error(`the server would refuse this photo: ${body}`);
      const { json, served } = await call(photoRequest({ model, image: body.image, media_type: body.media_type }));
      const out = toPhotoOutput(json);
      console.log(out.not_food ? '  No food found.' : `  ${out.items.length} foods named${served !== model ? ` [served by ${served}]` : ''}:`);
      for (const d of photoItemsToDrafts(out.items)) {
        const item = draftToLogItem(d);
        const t = item ? itemTotals(item) : null;
        const kcal = t && t.nutrients.energyKcal.status === 'complete' ? roundEstimate('energyKcal', t.nutrients.energyKcal) : null;
        console.log(`  - "${d.text}" -> ${d.match ? `${d.match.name}, ${d.quantity} ${d.unit ?? '(pick a unit)'}` : 'not in the food list'}${kcal ? `, ${kcal.low} to ${kcal.high} kcal (counted by the app)` : ''}`);
      }
    } catch (e) {
      failures++;
      console.log(`  FAIL: ${(e as Error).message}`);
    }
  }

  const [pin, pout] = PRICE[model]!;
  console.log(`\nTokens: ${inTok} in, ${outTok} out. Approximate cost: $${((inTok * pin + outTok * pout) / 1e6).toFixed(4)}.`);
  console.log(failures ? `${failures} request(s) failed.` : 'All requests completed.');
  return failures ? 1 : 0;
}

main().then((code) => process.exit(code));
