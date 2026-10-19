import type { Region, Restriction, RestrictionCode } from './types';

/**
 * Readiness screening (plan/08 section 4). Draft wording and dispositions pending professional
 * review (Q-13). "Not sure" is treated as "yes" for that item, and the UI says so.
 */

export type Answer = 'yes' | 'no' | 'not_sure';
export type QuestionId = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10';

export interface ReadinessQuestion {
  id: QuestionId;
  text: string;
  /** Only ask when this returns true for earlier answers. */
  askIf?: (a: Partial<Record<QuestionId, Answer>>) => boolean;
}

export const QUESTIONNAIRE_VERSION = 'readiness-draft-2026-10-19';

export const QUESTIONS: ReadinessQuestion[] = [
  { id: 'R1', text: 'In the past month, have you had chest pain, pressure or tightness, either at rest or during activity?' },
  { id: 'R2', text: 'In the past 12 months, have you fainted or had dizziness that made you lose your balance?' },
  { id: 'R3', text: 'Do you get unusually short of breath with light activity, such as walking on flat ground?' },
  { id: 'R4', text: 'Has a doctor told you that you have heart, kidney or liver disease, or diabetes?' },
  { id: 'R5', text: 'Do you take insulin, or tablets for diabetes that can cause low blood sugar?', askIf: (a) => a.R4 !== 'no' },
  { id: 'R6', text: 'Do you take medicine for blood pressure or heart rhythm?' },
  { id: 'R7', text: 'Are you pregnant, or have you given birth in the past 12 months?' },
  { id: 'R8', text: 'Do you have a bone, joint or muscle problem that gets worse with activity, or an injury or surgery in the past 6 months?' },
  { id: 'R9', text: 'Have you ever been diagnosed with or treated for an eating disorder?' },
  { id: 'R10', text: 'Are you taking medicine for weight loss, or has a doctor told you to limit physical activity for any other reason?' },
];

export interface ReadinessInput {
  answers: Partial<Record<QuestionId, Answer>>;
  /** Regions for R8. */
  regions?: Region[];
  /** The user confirmed a doctor cleared them for exercise (limited mode, plan/08). */
  medicalClearanceConfirmed?: boolean;
}

export type Disposition = 'clear' | 'limited' | 'excluded' | 'red_flag';

export interface ReadinessResult {
  disposition: Disposition;
  restrictions: Restriction[];
  /** Plain-language reasons the UI shows on S06b. */
  reasons: string[];
  /** Question IDs the user still needs to answer. */
  missing: QuestionId[];
}

const yes = (a: Answer | undefined) => a === 'yes' || a === 'not_sure';

export function requiredQuestions(answers: Partial<Record<QuestionId, Answer>>): QuestionId[] {
  return QUESTIONS.filter((q) => !q.askIf || q.askIf(answers)).map((q) => q.id);
}

export function assessReadiness(input: ReadinessInput): ReadinessResult {
  const a = input.answers;
  const missing = requiredQuestions(a).filter((id) => a[id] === undefined);
  const set = new Set<RestrictionCode>();
  const reasons: string[] = [];
  let disposition: Disposition = 'clear';
  const rank: Record<Disposition, number> = { clear: 0, limited: 1, excluded: 2, red_flag: 3 };
  const raise = (d: Disposition) => {
    if (rank[d] > rank[disposition]) disposition = d;
  };

  if (yes(a.R1) || yes(a.R2) || yes(a.R3)) {
    raise('red_flag');
    set.add('red_flag');
    set.add('clearance_required');
    reasons.push('You mentioned chest symptoms, fainting or breathlessness. Please see a doctor before exercising. If it is happening now, call 112.');
  }

  const medical = yes(a.R4) || yes(a.R5) || yes(a.R6) || yes(a.R10);
  if (medical) {
    raise('limited');
    if (!input.medicalClearanceConfirmed) {
      set.add('clearance_required');
      reasons.push('Until you confirm a doctor has cleared you for exercise, we only offer logging and general guidance.');
    }
    set.add('intensity_cap_moderate');
    set.add('no_deficit');
    reasons.push('Training stays light to moderate and we will not set a calorie deficit.');
  }
  if (yes(a.R4)) {
    set.add('no_high_protein');
    reasons.push('Protein targets stay in the general range; talk to your doctor before changing them.');
  }
  if (yes(a.R5)) {
    set.add('no_fasted_training');
    reasons.push('We will not suggest training on an empty stomach.');
  }

  if (yes(a.R7)) {
    raise('excluded');
    set.add('pregnancy');
    set.add('no_deficit');
    reasons.push('During pregnancy and the year after birth we offer logging and reviewed general information only.');
  }

  if (yes(a.R8)) {
    raise('limited');
    for (const r of input.regions ?? []) set.add(`region:${r}`);
    reasons.push((input.regions?.length ?? 0) > 0
      ? 'Exercises that load the area you mentioned are left out. A physiotherapist can advise on what is safe.'
      : 'Tell us which area is affected so we can leave out exercises that load it.');
  }

  if (yes(a.R9)) {
    raise('limited');
    set.add('non_numeric_only');
    reasons.push('We will not show calorie numbers or weigh-in prompts. You can find support resources in Help.');
  }

  const restrictions: Restriction[] = [...set].map((code) => ({ code, source: 'assessment' as const }));
  return { disposition, restrictions, reasons, missing };
}
