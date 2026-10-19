import assert from 'node:assert/strict';
import { test } from 'node:test';
import { draftToLogItem, parseMealText, type FoodUnit } from '../nutrition';

type Row = [id: string | null, quantity: number, unit: FoodUnit | null, confidence: 'high' | 'low'];
const rows = (text: string): Row[] => parseMealText(text).map((d) => [d.match?.id ?? null, d.quantity, d.unit, d.confidence]);

const CASES: [string, Row[]][] = [
  ['2 roti, dal, bhindi', [['roti', 2, 'piece', 'high'], ['dal_tadka', 1, 'katori', 'high'], ['bhindi_sabzi', 1, 'katori', 'high']]],
  ['ek katori dal and 2 rotis', [['dal_tadka', 1, 'katori', 'high'], ['roti', 2, 'piece', 'high']]],
  ['half plate rice', [['plain_rice', 0.5, 'plate', 'high']]],
  ['dedh roti', [['roti', 1.5, 'piece', 'high']]],
  ['do idli aur sambar', [['idli', 2, 'piece', 'high'], ['sambar', 1, 'katori', 'high']]],
  ['teen roti + paneer bhurji', [['roti', 3, 'piece', 'high'], ['paneer_bhurji', 1, 'katori', 'high']]],
  ['aadha katori chole', [['chole', 0.5, 'katori', 'high']]],
  ['dhai katori khichdi', [['khichdi', 2.5, 'katori', 'high']]],
  ['sawa roti', [['roti', 1.25, 'piece', 'high']]],
  ['sawa do roti', [['roti', 2.25, 'piece', 'high']]],
  ['paune katori dal', [['dal_tadka', 0.75, 'katori', 'high']]],
  ['100g paneer', [['paneer', 100, 'g', 'high']]],
  ['pav paneer', [['paneer', 250, 'g', 'high']]],
  ['aadha pav paneer', [['paneer', 125, 'g', 'high']]],
  ['1 glass milk', [['milk', 1, 'glass', 'high']]],
  ['1/2 cup curd', [['dahi', 0.5, 'cup', 'high']]],
  ['1 1/2 roti', [['roti', 1.5, 'piece', 'high']]],
  ['masala chai 200 ml', [['masala_chai', 200, 'ml', 'high']]],
  ['2 eggs', [['boiled_egg', 2, 'piece', 'high']]],
  ['a bowl of dal', [['dal_tadka', 1, 'katori', 'high']]],
  ['ek plate poha, chai', [['kanda_poha', 1, 'plate', 'high'], ['masala_chai', 1, 'cup', 'high']]],
  ['2 dosas; 1 katori sambar', [['dosa', 2, 'piece', 'high'], ['sambar', 1, 'katori', 'high']]],
  ['chhole\nbhindi', [['chole', 1, 'katori', 'high'], ['bhindi_sabzi', 1, 'katori', 'high']]],
  ['Ek katori DAL!!', [['dal_tadka', 1, 'katori', 'high']]],
  ['roti x2', [['roti', 2, 'piece', 'high']]],
  // Low confidence: a typo, a range, a unit the food does not have, or no amount for a weighed food.
  ['dal tadak', [['dal_tadka', 1, 'katori', 'low']]],
  ['3-4 roti', [['roti', 3.5, 'piece', 'low']]],
  ['2 katori roti', [['roti', 2, 'katori', 'low']]],
  ['paneer', [['paneer', 1, null, 'low']]],
];

for (const [input, expected] of CASES) {
  test(`parse: ${JSON.stringify(input)}`, () => assert.deepEqual(rows(input), expected));
}

test('unknown items are kept as unmatched, never dropped or guessed', () => {
  const out = parseMealText('2 roti, pizza, 2 slice garlic bread, pav bhaji');
  assert.equal(out.length, 4);
  assert.equal(out[0]!.match?.id, 'roti');
  for (const d of out.slice(1)) {
    assert.equal(d.unmatched, true, d.text);
    assert.equal(d.match, undefined, d.text);
    assert.equal(d.confidence, 'low');
  }
  // "garlic" is a known word, but "garlic bread" is not garlic: no partial guess.
  assert.deepEqual([out[2]!.text, out[2]!.foodText, out[2]!.quantity, out[2]!.unit], ['2 slice garlic bread', 'garlic bread', 2, 'piece']);
  // "pav" is 250 g only before a known food; "pav bhaji" stays as the user wrote it.
  assert.deepEqual([out[3]!.foodText, out[3]!.quantity, out[3]!.unit], ['pav bhaji', 1, null]);
});

test('empty and separator-only input gives no drafts', () => {
  assert.deepEqual(parseMealText(''), []);
  assert.deepEqual(parseMealText(' , and \n + '), []);
});

test('the parser only proposes: drafts become log items only when complete', () => {
  const [roti, unknown, paneer] = parseMealText('2 roti, pizza, paneer');
  assert.deepEqual(draftToLogItem(roti!, 'light'), { food: { kind: 'dish', id: 'roti' }, quantity: 2, unit: 'piece', oilLevel: 'light' });
  assert.equal(draftToLogItem(unknown!), null, 'unmatched needs a food');
  assert.equal(draftToLogItem(paneer!), null, 'paneer needs an amount');
});

test('impossible amounts are bounded and flagged for checking, never thrown', () => {
  const zero = parseMealText('0 roti')[0]!;
  assert.ok(zero.quantity > 0);
  assert.equal(zero.confidence, 'low');
  const huge = parseMealText('10 kg rice')[0]!;
  assert.ok(huge.quantity <= 5000);
  assert.equal(huge.confidence, 'low');
  assert.equal(draftToLogItem({ ...zero, quantity: 0 }), null);
});
