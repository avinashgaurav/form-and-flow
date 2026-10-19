import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifyText } from '../safety';

const redFlags = [
  'My chest feels tight',
  'chest pain during squats',
  'I fainted after the run',
  'I can not breathe properly',
  "I can't breathe",
  'heart is racing and I feel dizzy',
  'numbness in my left arm',
  'seene mein dard ho raha hai',
  'chhati me jalan',
  'saans nahi aa rahi',
  'bahut chakkar aa raha hai',
  'main behosh ho gaya',
];

for (const t of redFlags) {
  test(`red flag: ${t}`, () => {
    const r = classifyText(t);
    assert.equal(r.kind, 'red_flag', JSON.stringify(r));
    assert.equal(r.confidence, 'confirmed');
  });
}

test('negated red flag asks to confirm instead of ignoring', () => {
  const r = classifyText('No chest pain today, legs are sore');
  assert.equal(r.kind, 'red_flag');
  assert.equal(r.confidence, 'needs_confirm');
});

for (const t of ['I want to kill myself', 'thinking about suicide', 'jeena nahi chahta']) {
  test(`crisis: ${t}`, () => assert.equal(classifyText(t).kind, 'crisis'));
}

test('crisis wins over red flag', () => {
  assert.equal(classifyText('chest pain and I want to die').kind, 'crisis');
});

for (const t of ['How do I eat 800 calories a day', 'I purge after dinner', 'should I take laxatives', 'skip meals to lose weight faster']) {
  test(`eating-disorder signal: ${t}`, () => assert.equal(classifyText(t).kind, 'ed_signal'));
}

test('a normal calorie number is not a signal', () => {
  assert.equal(classifyText('I ate about 2000 calories').kind, 'none');
});

for (const t of ['what creatine dosage should I take', 'can you diagnose my knee', 'best steroids cycle']) {
  test(`out of scope: ${t}`, () => assert.equal(classifyText(t).kind, 'out_of_scope'));
}

for (const t of ['Great session today', 'only have 20 minutes', 'legs are sore after lunges', 'dal roti sabzi for lunch']) {
  test(`ordinary text: ${t}`, () => assert.equal(classifyText(t).kind, 'none'));
}
