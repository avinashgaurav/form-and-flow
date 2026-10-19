import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editDistance, normalize, searchFoods, singularize } from '../nutrition';

const top = (q: string) => searchFoods(q, { limit: 1 })[0];
const ids = (q: string, limit = 5) => searchFoods(q, { limit }).map((r) => r.id);

test('Hinglish aliases resolve', () => {
  assert.equal(top('dhaniya')?.id, 'coriander_leaves');
  assert.equal(top('kothmir')?.id, 'coriander_leaves');
  assert.equal(top('chawal')?.id, 'plain_rice');
  assert.equal(top('kela')?.id, 'banana_whole');
  assert.equal(top('anda bhurji')?.id, 'egg_bhurji');
  assert.equal(top('chai')?.id, 'masala_chai');
});

test('bhindi finds the cooked sabzi first, and the raw vegetable too', () => {
  const r = searchFoods('bhindi');
  assert.equal(r[0]?.id, 'bhindi_sabzi');
  assert.equal(r[0]?.exact, true);
  assert.ok(r.some((x) => x.kind === 'ingredient' && x.id === 'bhindi'));
});

test('chole and the chhole spelling both work', () => {
  assert.deepEqual([top('chole')?.id, top('chole')?.tier], ['chole', 'exact']);
  assert.deepEqual([top('chhole')?.id, top('chhole')?.tier], ['chole', 'alias']);
});

test('one typo is tolerated for words of 4+ letters, including swapped letters', () => {
  assert.equal(editDistance('sqaut', 'squat'), 1);
  assert.equal(editDistance('rajam', 'rajma'), 1);
  assert.equal(editDistance('kitten', 'sitting'), 3);
  assert.equal(editDistance('roti', 'roti'), 0);
  assert.deepEqual([top('rajam')?.id, top('rajam')?.tier], ['rajma_masala', 'fuzzy']);
  assert.equal(top('cholle')?.id, 'chole');
  assert.equal(top('panner bhurji')?.id, 'paneer_bhurji');
  assert.equal(top('dal tadak')?.id, 'dal_tadka');
  assert.equal(top('palakpaneer')?.id, 'palak_paneer');
});

test('short words get no typo tolerance', () => {
  assert.ok(!ids('dql', 20).includes('dal_tadka'));
  assert.ok(!ids('rti', 20).includes('roti'));
});

test('ranking: exact name > prefix > alias > word > fuzzy', () => {
  // "rice": the cooked dish (headword exact) beats the raw ingredient (prefix).
  const rice = searchFoods('rice');
  assert.deepEqual(rice.slice(0, 2).map((r) => [r.id, r.tier]), [['plain_rice', 'exact'], ['rice', 'prefix']]);
  // "egg": boiled egg is exact; egg bhurji and raw egg are prefixes, dish first.
  assert.deepEqual(ids('egg', 3), ['boiled_egg', 'egg_bhurji', 'egg']);
  // "dal": dal tadka's name starts with it; toor dal only contains the word.
  const dal = searchFoods('dal', { limit: 10 });
  assert.equal(dal[0]?.id, 'dal_tadka');
  assert.equal(dal.find((r) => r.id === 'toor_dal_cooked')?.tier, 'word');
  const rank = { exact: 0, prefix: 1, alias: 2, word: 3, fuzzy: 4 };
  for (const q of ['dal', 'paneer', 'rice', 'chai', 'moong']) {
    const tiers = searchFoods(q, { limit: 50 }).map((r) => rank[r.tier]);
    assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b), `tiers sorted for ${q}`);
  }
});

test('case, punctuation and plurals are ignored', () => {
  assert.equal(top('  ROTI!! ')?.id, 'roti');
  assert.equal(top('rotis')?.id, 'roti');
  assert.equal(top('idlis')?.exact, true);
  assert.equal(top('eggs')?.id, 'boiled_egg');
  assert.equal(normalize('Paneer-Bhurji (Home)'), 'paneer bhurji home');
  assert.equal(singularize('tomatoes'), 'tomato');
  assert.equal(singularize('glass'), 'glass');
  assert.equal(singularize('dal'), 'dal');
});

test('ordering is stable and options work', () => {
  assert.deepEqual(searchFoods('a', { limit: 50 }), searchFoods('a', { limit: 50 }));
  assert.equal(searchFoods('dal', { limit: 2 }).length, 2);
  assert.ok(searchFoods('paneer', { kinds: ['dish'] }).every((r) => r.kind === 'dish'));
  assert.deepEqual(searchFoods(''), []);
  assert.deepEqual(searchFoods('pizza'), []);
});
