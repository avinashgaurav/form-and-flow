/**
 * The eval's own number check, written separately from the app's validator so the two can disagree.
 * It is deliberately simpler: it ignores units and only asks "is this value an engine fact, or in a
 * card the reply cites?". Plate-guidance users may see no calorie or gram figure at all.
 */
import type { EvidenceCard } from '../../packages/engines/src/index.ts';

const WORDS: Record<string, number> = {
  three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};

export function figures(text: string): number[] {
  const clean = text.replace(/(\d),(?=\d{3}\b)/g, '$1');
  const digits = (clean.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  const words = (clean.toLowerCase().match(/\b[a-z]+\b/g) ?? []).filter((w) => w in WORDS).map((w) => WORDS[w]!);
  return [...digits, ...words];
}

export function wrongNumbers(text: string, facts: Record<string, number | string>, cited: EvidenceCard[], plateGuidance: boolean): string[] {
  const allowed = new Set<number>([
    ...Object.values(facts).filter((v): v is number => typeof v === 'number'),
    ...cited.flatMap((c) => (c.summary.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)),
  ]);
  const out = figures(text).filter((n) => !allowed.has(n)).map(String);
  if (plateGuidance) {
    for (const m of text.matchAll(/\d[\d,.]*\s*(?:g|gm|gms|grams?|kcal|cals?|calories?)\b/gi)) out.push(`plate-mode figure "${m[0]}"`);
  }
  return out;
}
