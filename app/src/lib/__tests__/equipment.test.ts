/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXERCISES, getExercise, type Equipment } from '@ff/engines';
import { equipmentList, equipmentText } from '../equipment';

const shown = (id: string) => {
  const e = getExercise(id)!;
  return equipmentText(e.anyOf, e.allOf);
};

test('required items join with "+", alternatives with "or"', () => {
  assert.equal(shown('bw_squat'), 'no equipment');
  assert.equal(shown('goblet_squat'), 'dumbbells or kettlebell');
  assert.equal(shown('hip_thrust'), 'bench + dumbbells or barbell');
  assert.equal(shown('bench_press'), 'barbell + bench + squat rack');
  assert.equal(shown('band_assisted_pullup'), 'pull-up bar + resistance band');
  assert.equal(shown('cable_row'), 'cable machine or weight machine');
  assert.equal(shown('pallof_press'), 'resistance band or cable machine');
});

test('no exercise or equipment list shows a raw equipment code', () => {
  const codes: Equipment[] = ['dumbbells', 'kettlebell', 'bands', 'bench', 'barbell', 'rack', 'cable', 'machines', 'pullup_bar'];
  // Codes that differ from their plain name and never appear inside one ("rack" is part of "squat rack").
  const raw = /\b(bands|machines|pullup_bar)\b/;
  for (const e of EXERCISES) assert.doesNotMatch(equipmentText(e.anyOf, e.allOf), raw, e.id);
  assert.doesNotMatch(equipmentList(codes), raw);
  assert.equal(equipmentList([]), 'none');
});
