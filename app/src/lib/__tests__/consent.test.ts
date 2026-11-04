/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aiConsentCurrent, aiNotice, AI_NOTICE, NOTICE_VERSION, noticeVersion } from '../../store/types';

test('the AI notice names the provider that gets the messages', () => {
  for (const screen of [true, false]) {
    assert.match(aiNotice('gemini', screen), /go to Google \(its Gemini AI\), our AI provider, which may process them outside India/);
    assert.doesNotMatch(aiNotice('gemini', screen), /Anthropic/);
    assert.match(aiNotice('anthropic', screen), /go to Anthropic, our AI provider, which may process them outside India/);
    assert.doesNotMatch(aiNotice('anthropic', screen), /Google|Gemini/);
  }
  // Google is the default provider for builds that do not set EXPO_PUBLIC_AI_PROVIDER.
  assert.equal(AI_NOTICE, aiNotice('gemini', false));
  assert.equal(NOTICE_VERSION, 'notice-draft-2026-11-04.4-noscreen');
});

test('the Anthropic notice text and versions are unchanged, so earlier agreements still match them', () => {
  assert.equal(noticeVersion('anthropic', true), 'notice-draft-2026-11-04.3');
  assert.equal(noticeVersion('anthropic', false), 'notice-draft-2026-10-19.2');
  assert.match(aiNotice('anthropic', true), /^If you allow it, these go to Anthropic, our AI provider, which may process them outside India: every coach message that the app's own safety word list/);
  assert.match(aiNotice('anthropic', false), /^If you allow it, two things go to Anthropic, our AI provider, which may process them outside India: a short summary of your plan/);
  // Every Gemini notice version is new, so no earlier agreement can count as agreeing to Google.
  for (const s of [true, false]) assert.notEqual(noticeVersion('gemini', s), noticeVersion('anthropic', s));
});

test('AI stays off until the user agrees to a notice naming the current provider', () => {
  const at = '2026-11-04T10:00:00.000Z';
  const old = { aiProcessing: true, version: 'notice-draft-2026-11-04.3', at };
  assert.equal(aiConsentCurrent(old, 'gemini'), false);
  assert.equal(aiConsentCurrent(old, 'anthropic'), true);
  const agreed = { aiProcessing: true, version: noticeVersion('gemini', true), at };
  assert.equal(aiConsentCurrent(agreed, 'gemini'), true);
  assert.equal(aiConsentCurrent(agreed, 'anthropic'), false);
  assert.equal(aiConsentCurrent({ ...agreed, aiProcessing: false }, 'gemini'), false);
  assert.equal(aiConsentCurrent(undefined, 'gemini'), false);
});
