import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assessReadiness, requiredQuestions, type Answer, type QuestionId } from '../readiness';
import { trainingPaused } from '../restrictions';

const allNo = (): Partial<Record<QuestionId, Answer>> =>
  Object.fromEntries(['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10'].map((q) => [q, 'no'])) as Partial<Record<QuestionId, Answer>>;
const codes = (r: ReturnType<typeof assessReadiness>) => r.restrictions.map((x) => x.code).sort();

test('all no is clear with no restrictions', () => {
  const r = assessReadiness({ answers: allNo() });
  assert.equal(r.disposition, 'clear');
  assert.deepEqual(r.restrictions, []);
  assert.deepEqual(r.missing, []);
});

for (const q of ['R1', 'R2', 'R3'] as const) {
  test(`${q} yes is a red flag that pauses training`, () => {
    const r = assessReadiness({ answers: { ...allNo(), [q]: 'yes' } });
    assert.equal(r.disposition, 'red_flag');
    assert.ok(trainingPaused(r.restrictions));
    assert.ok(r.reasons.some((x) => x.includes('112')));
  });
}

test('not sure counts as yes', () => {
  const r = assessReadiness({ answers: { ...allNo(), R2: 'not_sure' } });
  assert.equal(r.disposition, 'red_flag');
});

test('R4 without clearance pauses training and limits protein', () => {
  const r = assessReadiness({ answers: { ...allNo(), R4: 'yes' } });
  assert.equal(r.disposition, 'limited');
  assert.ok(trainingPaused(r.restrictions));
  assert.deepEqual(codes(r), ['clearance_required', 'intensity_cap_moderate', 'no_deficit', 'no_high_protein']);
});

test('R4 with confirmed clearance allows light-to-moderate training', () => {
  const r = assessReadiness({ answers: { ...allNo(), R4: 'yes' }, medicalClearanceConfirmed: true });
  assert.equal(trainingPaused(r.restrictions), false);
  assert.ok(codes(r).includes('intensity_cap_moderate'));
  assert.ok(codes(r).includes('no_deficit'));
});

test('R5 adds no fasted training', () => {
  const r = assessReadiness({ answers: { ...allNo(), R4: 'yes', R5: 'yes' }, medicalClearanceConfirmed: true });
  assert.ok(codes(r).includes('no_fasted_training'));
});

test('R5 is only asked when R4 is not no', () => {
  assert.ok(!requiredQuestions({ R4: 'no' }).includes('R5'));
  assert.ok(requiredQuestions({ R4: 'yes' }).includes('R5'));
  assert.ok(requiredQuestions({ R4: 'not_sure' }).includes('R5'));
});

test('R7 excludes programming (pregnancy)', () => {
  const r = assessReadiness({ answers: { ...allNo(), R7: 'yes' } });
  assert.equal(r.disposition, 'excluded');
  assert.ok(trainingPaused(r.restrictions));
});

test('R8 with a region restricts that region only', () => {
  const r = assessReadiness({ answers: { ...allNo(), R8: 'yes' }, regions: ['knee'] });
  assert.deepEqual(codes(r), ['region:knee']);
  assert.equal(trainingPaused(r.restrictions), false);
});

test('R9 forces non-numeric mode', () => {
  const r = assessReadiness({ answers: { ...allNo(), R9: 'yes' } });
  assert.ok(codes(r).includes('non_numeric_only'));
});

test('red flag outranks everything else', () => {
  const r = assessReadiness({ answers: { ...allNo(), R1: 'yes', R7: 'yes', R9: 'yes' } });
  assert.equal(r.disposition, 'red_flag');
});

test('missing answers are reported', () => {
  const r = assessReadiness({ answers: { R1: 'no' } });
  assert.ok(r.missing.includes('R2'));
  assert.ok(!r.missing.includes('R1'));
});
