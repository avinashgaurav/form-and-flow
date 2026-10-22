/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stepFix } from '../onboardingStep';

test('the plan preview stays open once setup is done and a plan exists', () => {
  // Regression: buildPlan goes to step 6, and the guard used to send it back to 5.
  assert.equal(stepFix(6, 5, 'clear', true), null);
  assert.equal(stepFix(6, 5, 'care', true), null);
});

test('the plan preview without a plan goes back to the week', () => {
  assert.equal(stepFix(6, 5, 'clear', false), 5);
});

test('a draft past the first unfinished step goes back to it', () => {
  assert.equal(stepFix(6, 3, 'clear', true), 3);
  assert.equal(stepFix(5, 3, 'clear', false), 3);
  assert.equal(stepFix(3, 2, 'clear', false), 2);
  assert.equal(stepFix(7, 5, 'clear', true), 5);
});

test('other steps keep their old behaviour', () => {
  assert.equal(stepFix(4, 5, 'clear', false), 5);
  assert.equal(stepFix(4, 5, 'care', false), null);
  assert.equal(stepFix(5, 5, 'clear', false), null);
  assert.equal(stepFix(2, 5, 'clear', false), null);
  assert.equal(stepFix(0, 1, 'clear', false), null);
});
