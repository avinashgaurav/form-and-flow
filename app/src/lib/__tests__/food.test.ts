/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState, type AppState } from '../../store/types';
import { fmtPortion, fmtTotal, nutritionFacts, numericMode, toMealItem } from '../food';

function state(): AppState {
  return {
    ...initialState(),
    profile: {
      birthYear: 1992, units: 'metric', tone: 'gentle', timezone: 'Asia/Kolkata', goal: 'fat_loss', heightCm: 170, weightKg: 80, activity: 'light',
      training: { goal: 'fat_loss', experience: 'none', location: 'home', equipment: [], daysAvailable: [0, 2, 4], sessionMinutes: 30 },
    },
  };
}

test('a non_numeric_only limit forces plate guidance even if numbers were chosen', () => {
  const s = state();
  assert.equal(numericMode(s), true);
  s.restrictions = [{ code: 'non_numeric_only', source: 'assessment' }];
  assert.equal(numericMode(s), false);
});

test('the coach gets no nutrition numbers in plate-guidance mode', () => {
  const s = state();
  assert.ok(Object.keys(nutritionFacts(s)).length > 0);
  s.nutrition = { ...s.nutrition, mode: 'non_numeric' };
  assert.deepEqual(nutritionFacts(s), {});
});

test('missing values are never shown as zero', () => {
  assert.equal(fmtTotal('energyKcal', { status: 'incomplete', missingFrom: ['x'], knownPart: { mid: 0, low: 0, high: 0 } }), 'not available');
  assert.match(fmtTotal('energyKcal', { status: 'incomplete', missingFrom: ['x'], knownPart: { mid: 200, low: 180, high: 220 } }), /^at least 180 kcal/);
  assert.equal(fmtTotal('proteinG', { status: 'complete', mid: 12, low: 10, high: 14 }), '10 to 14 g protein');
});

test('a portion the engine cannot size is not logged', () => {
  assert.equal(toMealItem('x', 'Mystery', { food: { kind: 'dish', id: 'no_such_dish' }, quantity: 1, unit: 'katori' }), null);
  assert.ok(toMealItem('y', 'Dal tadka', { food: { kind: 'dish', id: 'dal_tadka' }, quantity: 1, unit: 'katori' }));
});

test('portions read naturally', () => {
  assert.equal(fmtPortion(1, 'katori'), '1 katori');
  assert.equal(fmtPortion(1.5, 'piece'), '1.5 pieces');
  assert.equal(fmtPortion(0.25, 'cup'), '0.25 cups');
});
