import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calendarDay, daysBetween, isLateNight, logicalDay, weekdayIndex } from '../days';
import { displayWeight, inputWeightToKg, kgToLb, lbToKg, needsPlausibilityCheck, roundToStep } from '../units';

test('kg to lb round trip is lossless', () => {
  for (const kg of [0, 1, 16, 62.5, 100, 249.9]) assert.ok(Math.abs(lbToKg(kgToLb(kg)) - kg) < 1e-9);
});

test('display never changes the stored value', () => {
  const stored = 16;
  assert.deepEqual(displayWeight(stored, 'imperial'), { value: 35.3, unit: 'lb' });
  assert.equal(stored, 16);
  assert.ok(Math.abs(inputWeightToKg(35.27, 'imperial') - 16) < 0.01);
});

test('roundToStep', () => {
  assert.equal(roundToStep(18.2, 2.5), 17.5);
  assert.equal(roundToStep(18.9, 1), 19);
  assert.throws(() => roundToStep(1, 0));
});

test('plausibility check flags odd BMI without rejecting', () => {
  assert.equal(needsPlausibilityCheck(170, 70), false);
  assert.equal(needsPlausibilityCheck(160, 180), true);
});

test('a meal at 00:30 in India belongs to the previous day', () => {
  const t = new Date('2026-10-19T19:00:00Z'); // 00:30 IST on 20 October
  assert.equal(calendarDay(t, 'Asia/Kolkata'), '2026-10-20');
  assert.equal(logicalDay(t, 'Asia/Kolkata'), '2026-10-19');
  assert.equal(isLateNight(t, 'Asia/Kolkata'), true);
});

test('daytime events keep their calendar day', () => {
  const t = new Date('2026-10-19T05:00:00Z'); // 10:30 IST
  assert.equal(logicalDay(t, 'Asia/Kolkata'), '2026-10-19');
  assert.equal(isLateNight(t, 'Asia/Kolkata'), false);
});

test('the same instant is a different day in London', () => {
  const t = new Date('2026-10-19T19:00:00Z');
  assert.equal(logicalDay(t, 'Europe/London'), '2026-10-19');
});

test('weekday index starts on Monday', () => {
  assert.equal(weekdayIndex(new Date('2026-10-19T06:00:00Z'), 'Asia/Kolkata'), 0);
  assert.equal(weekdayIndex(new Date('2026-10-25T06:00:00Z'), 'Asia/Kolkata'), 6);
});

test('daysBetween', () => {
  assert.equal(daysBetween('2026-10-19', '2026-10-26'), 7);
  assert.equal(daysBetween('2026-10-26', '2026-10-19'), -7);
});
