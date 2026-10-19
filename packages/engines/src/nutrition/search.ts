import { CATALOGUE, type Catalogue, type FoodRef } from './catalogue';

/**
 * Food search over names and aliases (plan/07 S21). Case and punctuation are ignored, plurals are
 * folded ("rotis", "eggs"), and words of 4 or more letters tolerate one typo, counting a swap of two
 * neighbouring letters as one typo ("sqaut", "rajam"). Ranking: exact name > name prefix > alias >
 * word inside a name > fuzzy. Within a tier, dishes come before raw ingredients, then shorter names,
 * then IDs, so the order is stable.
 */

export type MatchTier = 'exact' | 'prefix' | 'alias' | 'word' | 'fuzzy';

const TIER_RANK: Record<MatchTier, number> = { exact: 0, prefix: 1, alias: 2, word: 3, fuzzy: 4 };

export interface SearchResult extends FoodRef {
  name: string;
  tier: MatchTier;
  /** The query (plurals folded) equals the name, its headword or an alias. */
  exact: boolean;
}

export interface SearchOptions {
  limit?: number;
  kinds?: FoodRef['kind'][];
  catalogue?: Catalogue;
}

/** Lower case, strip Latin accents and punctuation, collapse spaces. Devanagari letters and marks are kept. */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

/** Name without bracketed qualifiers: "Egg (boiled)" has the headword "egg". */
export function headword(name: string): string {
  return normalize(name.replace(/\([^)]*\)/g, ' '));
}

/** English plural to singular for one word; short words are left alone. */
export function singularize(word: string): string {
  if (word.length <= 3 || !/[a-z]s$/.test(word) || word.endsWith('ss')) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes')) return word.slice(0, -2);
  return word.slice(0, -1);
}

/** Edit distance where a swap of two neighbouring letters counts as one edit (optimal string alignment). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, d[i - 2]![j - 2]! + 1);
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

const closeEnough = (q: string, c: string) => q === c || (q.length >= 4 && editDistance(q, c) <= 1);

/** One typo allowed per word of 4+ letters, words in order; the candidate may have extra words at the end. */
function fuzzyMatch(query: string, candidate: string): boolean {
  if (closeEnough(query, candidate)) return true;
  const qw = query.split(' ');
  const cw = candidate.split(' ');
  if (qw.length > cw.length) return false;
  return qw.every((w, i) => closeEnough(w, cw[i]!));
}

interface Entry {
  ref: FoodRef;
  name: string;
  nameN: string;
  headN: string;
  aliasesN: string[];
}

const indexCache = new WeakMap<Catalogue, Entry[]>();

function entries(catalogue: Catalogue): Entry[] {
  let list = indexCache.get(catalogue);
  if (list) return list;
  list = [];
  for (const d of catalogue.dishes.values())
    list.push({ ref: { kind: 'dish', id: d.id }, name: d.name, nameN: normalize(d.name), headN: headword(d.name), aliasesN: d.aliases.map(normalize) });
  for (const i of catalogue.ingredients.values())
    list.push({ ref: { kind: 'ingredient', id: i.id }, name: i.name, nameN: normalize(i.name), headN: headword(i.name), aliasesN: i.aliases.map(normalize) });
  indexCache.set(catalogue, list);
  return list;
}

interface Score {
  tier: MatchTier;
  /** Inside the alias tier, an exact alias (0) beats an alias prefix (1). */
  sub: number;
  exact: boolean;
}

function scoreOne(e: Entry, q: string): Score | null {
  if (e.nameN === q || e.headN === q) return { tier: 'exact', sub: 0, exact: true };
  const aliasExact = e.aliasesN.includes(q);
  if (e.nameN.startsWith(q) || e.headN.startsWith(q)) return { tier: 'prefix', sub: 0, exact: aliasExact };
  if (aliasExact) return { tier: 'alias', sub: 0, exact: true };
  if (e.aliasesN.some((a) => a.startsWith(q))) return { tier: 'alias', sub: 1, exact: false };
  if ([e.nameN, ...e.aliasesN].some((s) => ` ${s}`.includes(` ${q}`))) return { tier: 'word', sub: 0, exact: false };
  if ([e.nameN, e.headN, ...e.aliasesN].some((s) => fuzzyMatch(q, s))) return { tier: 'fuzzy', sub: 0, exact: false };
  return null;
}

const better = (a: Score, b: Score) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.sub - b.sub || Number(b.exact) - Number(a.exact);

/** Search dishes and ingredients. Returns at most `limit` results (default 20), best first. */
export function searchFoods(query: string, opts: SearchOptions = {}): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const variants = [...new Set([q, q.split(' ').map(singularize).join(' ')])];
  const catalogue = opts.catalogue ?? CATALOGUE;
  const scored: { e: Entry; s: Score }[] = [];
  for (const e of entries(catalogue)) {
    if (opts.kinds && !opts.kinds.includes(e.ref.kind)) continue;
    let best: Score | null = null;
    for (const v of variants) {
      const s = scoreOne(e, v);
      if (s && (!best || better(s, best) < 0)) best = s;
    }
    if (best) scored.push({ e, s: best });
  }
  scored.sort(
    (a, b) =>
      better(a.s, b.s) ||
      (a.e.ref.kind === b.e.ref.kind ? 0 : a.e.ref.kind === 'dish' ? -1 : 1) ||
      a.e.nameN.length - b.e.nameN.length ||
      a.e.ref.id.localeCompare(b.e.ref.id),
  );
  return scored.slice(0, opts.limit ?? 20).map(({ e, s }) => ({ kind: e.ref.kind, id: e.ref.id, name: e.name, tier: s.tier, exact: s.exact }));
}
