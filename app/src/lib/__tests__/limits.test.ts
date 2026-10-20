/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shortDay } from '@ff/engines';
import { limitText, sentence } from '../limits';

test('dates read as "26 Oct", not ISO', () => {
  assert.equal(shortDay('2026-10-26'), '26 Oct');
  assert.equal(shortDay('2027-01-05'), '5 Jan');
  assert.equal(shortDay('2026-10-26T08:30:00.000Z'), '26 Oct');
  assert.equal(shortDay('2026-13-05'), '2026-13-05');
});

test('reasons end with exactly one full stop', () => {
  assert.equal(sentence('Rest on Tue'), 'Rest on Tue.');
  assert.equal(sentence('Protein guide from ICMR-NIN.'), 'Protein guide from ICMR-NIN.');
  assert.equal(sentence('Ready? '), 'Ready?');
});

test('safety limits read as plain sentences, never codes', () => {
  assert.equal(limitText({ code: 'region:knee' }), 'Leaving out moves that load your knee');
  assert.equal(limitText({ code: 'region:lower_back', expiresAt: '2026-10-26' }), 'Leaving out moves that load your lower back until 26 Oct');
  assert.equal(limitText({ code: 'non_numeric_only' }), 'Plate guidance instead of numbers');
  for (const code of ['red_flag', 'pregnancy', 'clearance_required', 'intensity_cap_moderate', 'no_deficit', 'no_high_protein', 'no_fasted_training', 'non_numeric_only'] as const) {
    assert.doesNotMatch(limitText({ code }), /_/, code);
  }
});
