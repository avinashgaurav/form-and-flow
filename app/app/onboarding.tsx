import {
  QUESTIONNAIRE_VERSION,
  QUESTIONS,
  RANGES,
  assessReadiness,
  inRange,
  needsPlausibilityCheck,
  requiredQuestions,
  type Answer,
  type Equipment,
  type Goal,
  type QuestionId,
  type Region,
} from '@ff/engines';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { stepFix } from '../src/lib/onboardingStep';
import { deviceTimeZone, makePlan, plural } from '../src/lib/plan';
import { useStore } from '../src/store/store';
import { NOTICE_VERSION, emptyDraft, type AppState, type Profile } from '../src/store/types';
import { color, space } from '../src/theme';
import { Banner, Button, Card, Checkbox, ChipGroup, Eyebrow, Field, Row, Screen, Stepper, T } from '../src/ui';

/**
 * Four short steps, then the plan. Everything else starts from a safe default and can be changed
 * later: experience (new to it), daily activity (some walking) and coach style (gentle) are set
 * here; the AI coach stays off until someone turns it on in Settings.
 *
 * Step numbers: 0 welcome, 1 about you, 2 goal and body, 3 safety, 4 safety result (only when
 * something needs care), 5 your week, 6 the plan preview.
 */
const PROGRESS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 4 };
const STEP_COUNT = 4;

const EXPERIENCE = [
  { value: 'none', label: 'New to it' },
  { value: 'lt6m', label: 'Under 6 months' },
  { value: '6to24m', label: '6 to 24 months' },
  { value: 'gt2y', label: '2+ years' },
] as const;
const ACTIVITY = [
  { value: 'low', label: 'Mostly sitting' },
  { value: 'light', label: 'Some walking' },
  { value: 'moderate', label: 'On my feet a lot' },
  { value: 'high', label: 'Physical work' },
] as const;
// The one-line summary of the two pre-set answers, e.g. "New to training · some walking each day".
const EXPERIENCE_SUMMARY = { none: 'New to training', lt6m: 'Training under 6 months', '6to24m': 'Training 6 to 24 months', gt2y: 'Training 2+ years' } as const;
const ACTIVITY_SUMMARY = { low: 'mostly sitting each day', light: 'some walking each day', moderate: 'on your feet a lot', high: 'physical work' } as const;
const DEFAULT_EXPERIENCE = 'none';
const DEFAULT_ACTIVITY = 'light';

const GOALS: { value: Goal; label: string }[] = [
  { value: 'fat_loss', label: 'Lose fat' },
  { value: 'muscle_gain', label: 'Build muscle' },
  { value: 'strength', label: 'Get stronger' },
  { value: 'fitness', label: 'Fitness and stamina' },
  { value: 'mobility', label: 'Mobility' },
  { value: 'habits', label: 'Build the habit' },
  { value: 'maintenance', label: 'Maintain' },
];

const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'bands', label: 'Resistance bands' },
  { value: 'bench', label: 'Bench or sturdy step' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'rack', label: 'Squat rack' },
  { value: 'cable', label: 'Cable machine' },
  { value: 'machines', label: 'Gym machines' },
  { value: 'pullup_bar', label: 'Pull-up bar' },
];

const REGIONS: { value: Region; label: string }[] = [
  { value: 'knee', label: 'Knee' },
  { value: 'lower_back', label: 'Lower back' },
  { value: 'shoulder', label: 'Shoulder' },
  { value: 'wrist', label: 'Wrist' },
  { value: 'hip', label: 'Hip' },
  { value: 'ankle', label: 'Ankle' },
  { value: 'elbow', label: 'Elbow' },
  { value: 'neck', label: 'Neck' },
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, value) => ({ value, label }));
const ANSWERS: { value: Answer; label: string }[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes' },
  { value: 'not_sure', label: 'Not sure' },
];

const thisYear = new Date().getFullYear();

/**
 * The first step whose answers are missing or out of range: 1 about you, 2 goal and body,
 * 3 safety; 5 when everything before the week is done.
 */
function firstUnfinished(d: AppState['draft'], readiness: ReturnType<typeof assessReadiness>, medicalYes: boolean): number {
  const y = Number(d.birthYear);
  if (!/^\d{4}$/.test(d.birthYear ?? '') || thisYear - y < 18 || thisYear - y > 100 || !d.consentCore) return 1;
  if (!d.goal || !inRange(Number(d.heightCm), RANGES.heightCm) || (d.weightKg && !inRange(Number(d.weightKg), RANGES.weightKg))) return 2;
  if (readiness.missing.length || (d.answers.R8 === 'yes' && d.regions.length === 0) || (medicalYes && d.clearance === undefined)) return 3;
  return 5;
}
const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export default function Onboarding() {
  const { state, dispatch } = useStore();
  const d = state.draft;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [blocked, setBlocked] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const readiness = assessReadiness({ answers: d.answers, regions: d.regions, medicalClearanceConfirmed: d.clearance });
  const medicalYes = (['R4', 'R5', 'R6', 'R10'] as QuestionId[]).some((q) => d.answers[q] === 'yes' || d.answers[q] === 'not_sure');
  const ready = firstUnfinished(d, readiness, medicalYes);

  // A draft saved by the older, longer setup can sit on a step whose earlier answers were never
  // checked here: send it back to the first unfinished step, so no safety question is skipped.
  useEffect(() => {
    if (state.onboarded) return;
    const fix = stepFix(d.step, ready, readiness.disposition, !!state.plan);
    if (fix !== null && fix !== d.step) dispatch({ type: 'draft', patch: { step: fix } });
  }, [state.onboarded, d.step, ready, readiness.disposition, state.plan, dispatch]);

  if (state.onboarded) return <Redirect href="/" />;

  const set = (patch: Partial<AppState['draft']>) => dispatch({ type: 'draft', patch });
  const go = (step: number) => {
    setErrors({});
    set({ step });
  };

  function next() {
    const e: Record<string, string> = {};
    if (d.step === 1) {
      const y = Number(d.birthYear);
      if (!/^\d{4}$/.test(d.birthYear ?? '')) e.birthYear = 'Enter the year you were born, for example 1990.';
      else if (thisYear - y < 18) {
        setBlocked(true);
        dispatch({ type: 'patch', patch: { draft: emptyDraft() } });
        return;
      } else if (thisYear - y > 100) e.birthYear = 'Please check the year.';
      if (!d.consentCore) e.consent = 'Tick the box to continue. Your plan needs this to work.';
    }
    if (d.step === 2) {
      if (!d.goal) e.goal = 'Pick the goal that matters most right now.';
      const h = Number(d.heightCm);
      if (!inRange(h, RANGES.heightCm)) e.height = 'Height should be between 120 and 220 cm.';
      if (d.weightKg && !inRange(Number(d.weightKg), RANGES.weightKg)) e.weight = 'Weight should be between 30 and 250 kg.';
    }
    if (d.step === 3) {
      if (readiness.missing.length) e.readiness = 'Please answer every question. "Not sure" is fine.';
      if (d.answers.R8 === 'yes' && d.regions.length === 0) e.regions = 'Choose the area that is affected.';
      if (medicalYes && d.clearance === undefined) e.clearance = 'Please answer the clearance question.';
    }
    if (d.step === 5) {
      if (!d.location) e.location = 'Where will you train?';
      if (d.days.length === 0) e.days = 'Choose at least one day.';
    }
    if (Object.keys(e).length) return setErrors(e);

    if (d.step === 3 && readiness.disposition === 'clear') return go(5);
    if (d.step === 5) return buildPlan();
    go(d.step + 1);
  }

  function back() {
    if (d.step === 5 && readiness.disposition === 'clear') return go(3);
    go(Math.max(0, d.step - 1));
  }

  function buildPlan() {
    if (ready < 5) return go(ready);
    const profile: Profile = {
      birthYear: Number(d.birthYear),
      units: d.units,
      tone: d.tone ?? 'gentle',
      timezone: deviceTimeZone(),
      goal: d.goal!,
      heightCm: Number(d.heightCm),
      weightKg: d.weightKg ? Number(d.weightKg) : undefined,
      activity: d.activity ?? DEFAULT_ACTIVITY,
      training: { goal: d.goal!, experience: d.experience ?? DEFAULT_EXPERIENCE, location: d.location!, equipment: d.equipment, daysAvailable: [...d.days].sort(), sessionMinutes: d.minutes },
    };
    const now = new Date().toISOString();
    const next: AppState = {
      ...state,
      profile,
      // The AI coach stays off until the person turns it on in Settings.
      consents: { core: true, aiProcessing: state.consents?.aiProcessing ?? false, version: NOTICE_VERSION, at: now },
      readiness: { answers: d.answers, regions: d.regions, clearance: !!d.clearance, result: readiness, at: now },
      restrictions: readiness.restrictions,
    };
    dispatch({ type: 'patch', patch: { profile: next.profile, consents: next.consents, readiness: next.readiness, restrictions: next.restrictions, plan: makePlan(next, 1) } });
    go(6);
  }

  function accept() {
    if (!state.plan) return;
    dispatch({ type: 'patch', patch: { plan: { ...state.plan, acceptedAt: new Date().toISOString() }, onboarded: true } });
  }

  if (blocked) {
    return (
      <Screen>
        <T v="title">Not available under 18</T>
        <T>Form & Flow is built for adults. Nothing you entered has been kept.</T>
        <Button label="Back to start" kind="secondary" onPress={() => setBlocked(false)} />
      </Screen>
    );
  }

  const progress = d.step === 6 ? 'Your plan' : `Step ${PROGRESS[d.step] ?? 1} of ${STEP_COUNT}`;

  return (
    <Screen>
      {d.step > 0 && (
        <Row style={{ justifyContent: 'space-between' }}>
          <Button label="Back" kind="ghost" icon="back" onPress={back} />
          <T v="label" accessibilityRole="text">{progress}</T>
        </Row>
      )}

      {d.step === 0 && (
        <View style={{ gap: space.lg }}>
          <Eyebrow>Pilot build</Eyebrow>
          <T v="title">Form & Flow</T>
          <T>A coach that plans your training around your real week and explains every change.</T>
          <Card>
            <T v="h2">What it does</T>
            <T>Builds a weekly plan from your goal, time and equipment. Adjusts from what you log. Stops and points you to help when something sounds unsafe.</T>
            <T v="h2">What it does not do</T>
            <T>Diagnose, treat, prescribe supplements or medicines, or replace your doctor or physiotherapist.</T>
          </Card>
          <Banner tone="warn" title="Draft content" body="Exercises and rules in this build are drafts that a qualified coach has not reviewed yet. It is for pilot use only." />
          <Button label="Get started" onPress={() => go(1)} tall />
        </View>
      )}

      {d.step === 1 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">About you</T>
          <Field label="Year of birth" keyboardType="numeric" value={d.birthYear ?? ''} onChangeText={(t) => set({ birthYear: t.replace(/\D/g, '').slice(0, 4) })} placeholder="For example 1990" hint="For adults only. We keep just the year." error={errors.birthYear} />
          <Card>
            <T v="h2">How we use your data</T>
            <T v="small">We keep your profile, safety answers and logs on this phone to build and adjust your plan. If you turn on backup, a copy is kept in your account. You can export or delete it in Settings at any time.</T>
            <Checkbox label="I agree to how my data is used" value={!!d.consentCore} onChange={(consentCore) => set({ consentCore })} />
            {errors.consent && <T v="small" accessibilityRole="alert" style={{ color: color.danger }}>{errors.consent}</T>}
          </Card>
          <Button label="Continue" onPress={next} tall />
        </View>
      )}

      {d.step === 2 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">What matters most right now?</T>
          <ChipGroup options={GOALS} value={d.goal} onChange={(goal) => set({ goal })} />
          {errors.goal && <T v="small" style={{ color: color.danger }}>{errors.goal}</T>}
          <Field label="Height (cm)" keyboardType="numeric" value={d.heightCm ?? ''} onChangeText={(t) => set({ heightCm: t.replace(/[^\d.]/g, '') })} placeholder="For example 170" error={errors.height} />
          <Field label="Weight in kg (optional)" keyboardType="numeric" value={d.weightKg ?? ''} onChangeText={(t) => set({ weightKg: t.replace(/[^\d.]/g, '') })} hint="Only used for your food guide. Leave it blank to skip." error={errors.weight} />
          {d.heightCm && d.weightKg && needsPlausibilityCheck(Number(d.heightCm), Number(d.weightKg)) && (
            <Banner tone="warn" title="Please double-check" body="That height and weight combination is unusual. If it is right, carry on." />
          )}
          <Card tone="sunken">
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="small" style={{ flex: 1, color: color.ink }}>
                {`${EXPERIENCE_SUMMARY[d.experience ?? DEFAULT_EXPERIENCE]} · ${ACTIVITY_SUMMARY[d.activity ?? DEFAULT_ACTIVITY]}`}
              </T>
              <Button label={showMore ? 'Done' : 'Change'} kind="ghost" onPress={() => setShowMore(!showMore)} />
            </Row>
            {showMore && (
              <View style={{ gap: space.sm }}>
                <T v="label">Training experience</T>
                <ChipGroup options={[...EXPERIENCE]} value={d.experience ?? DEFAULT_EXPERIENCE} onChange={(experience) => set({ experience })} />
                <T v="label">Day-to-day activity</T>
                <ChipGroup options={[...ACTIVITY]} value={d.activity ?? DEFAULT_ACTIVITY} onChange={(activity) => set({ activity })} />
              </View>
            )}
          </Card>
          <Button label="Continue" onPress={next} tall />
        </View>
      )}

      {d.step === 3 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">Safety questions</T>
          <T v="small">So we never suggest something risky for you. "Not sure" counts as yes for that question. These answers stay on your phone.</T>
          {QUESTIONS.filter((q) => requiredQuestions(d.answers).includes(q.id)).map((q) => (
            <Card key={q.id}>
              <T>{q.text}</T>
              <ChipGroup options={ANSWERS} value={d.answers[q.id]} onChange={(a) => set({ answers: { ...d.answers, [q.id]: a } })} />
              {q.id === 'R8' && (d.answers.R8 === 'yes' || d.answers.R8 === 'not_sure') && (
                <View style={{ gap: space.sm }}>
                  <T v="label">Which area?</T>
                  <ChipGroup multi options={REGIONS} value={d.regions} onChange={(r) => set({ regions: toggle(d.regions, r) })} />
                  {errors.regions && <T v="small" style={{ color: color.danger }}>{errors.regions}</T>}
                </View>
              )}
            </Card>
          ))}
          {medicalYes && (
            <Card tone="warn">
              <T>Has a doctor cleared you for exercise?</T>
              <ChipGroup
                options={[{ value: 'yes', label: 'Yes, I am cleared' }, { value: 'no', label: 'No or not sure' }]}
                value={d.clearance === undefined ? undefined : d.clearance ? 'yes' : 'no'}
                onChange={(v) => set({ clearance: v === 'yes' })}
              />
              {errors.clearance && <T v="small" style={{ color: color.danger }}>{errors.clearance}</T>}
            </Card>
          )}
          {errors.readiness && <Banner tone="danger" title={errors.readiness} />}
          <Button label="Continue" onPress={next} tall />
        </View>
      )}

      {d.step === 4 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">{readiness.disposition === 'red_flag' ? 'Please see a doctor first' : 'Here is what we will do'}</T>
          {readiness.disposition === 'red_flag' && (
            <>
              <Banner tone="danger" title="If this is happening now, call 112" body="Chest symptoms, fainting or severe breathlessness need a doctor before any exercise programme." />
              <Button label="Call 112" kind="danger" icon="phone" onPress={() => Linking.openURL('tel:112')} />
            </>
          )}
          <Card>
            {readiness.reasons.map((r) => (
              <Row key={r} style={{ alignItems: 'flex-start' }}>
                <T v="small" style={{ color: color.ink }}>{'•'}</T>
                <T v="small" style={{ flex: 1, color: color.ink }}>{r}</T>
              </Row>
            ))}
          </Card>
          <T v="small">You can update these answers any time in Settings. Questionnaire version {QUESTIONNAIRE_VERSION}.</T>
          <Button label="Continue in limited mode" onPress={next} tall />
        </View>
      )}

      {d.step === 5 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">Your week</T>
          <T v="label">Where</T>
          <ChipGroup
            options={[{ value: 'home', label: 'Home' }, { value: 'gym', label: 'Gym' }, { value: 'both', label: 'Both' }]}
            value={d.location}
            onChange={(location) =>
              set({ location, equipment: location === 'gym' ? ['dumbbells', 'bench', 'barbell', 'rack', 'cable', 'machines', 'pullup_bar'] : d.equipment })
            }
          />
          {errors.location && <T v="small" style={{ color: color.danger }}>{errors.location}</T>}
          <T v="label">Equipment you can use</T>
          <ChipGroup multi options={EQUIPMENT} value={d.equipment} onChange={(e) => set({ equipment: toggle(d.equipment, e) })} />
          <T v="small">No equipment is fine: you will get a bodyweight plan.</T>
          <T v="label">Days you could train</T>
          <ChipGroup multi options={DAYS} value={d.days} onChange={(day) => set({ days: toggle(d.days, day) })} />
          {errors.days && <T v="small" style={{ color: color.danger }}>{errors.days}</T>}
          <T v="label">Time per session</T>
          <Stepper label="Minutes per session" unit="min" value={d.minutes} min={RANGES.sessionMinutes.min} max={RANGES.sessionMinutes.max} step={5} onChange={(minutes) => set({ minutes })} />
          <Button label="Build my week" onPress={next} tall />
        </View>
      )}

      {d.step === 6 && state.plan && <Preview onAccept={accept} onEdit={() => go(5)} />}
    </Screen>
  );
}

function Preview({ onAccept, onEdit }: { onAccept: () => void; onEdit: () => void }) {
  const { state } = useStore();
  const week = state.plan!.week;
  const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <View style={{ gap: space.lg }}>
      <T v="h1">Your first week</T>
      {week.paused ? (
        <Banner tone="warn" title="Training is paused for now" body="Until the safety step is resolved you can still log, learn and explore. Update your answers in Settings once you have been cleared." />
      ) : (
        week.sessions.map((s) => (
          <Card key={s.id}>
            <Eyebrow>{DAY[s.day]!}</Eyebrow>
            <T v="h2">{s.title}</T>
            <T v="small">{`About ${s.estimatedMinutes} min · ${plural(s.blocks.length, 'exercise')}`}</T>
          </Card>
        ))
      )}
      <Card tone="sunken">
        <T v="h2">Why it looks like this</T>
        {week.reasons.map((r) => (
          <T key={r.ruleId + r.text} v="small" style={{ color: color.ink }}>{`${r.text}.`}</T>
        ))}
      </Card>
      {week.needsReview.length > 0 && <Banner tone="warn" title="Draft plan" body="Some starting amounts have not been checked by a coach yet." />}
      <Button label="Accept and start" onPress={onAccept} tall />
      <Button label="Change my setup" kind="secondary" onPress={onEdit} />
    </View>
  );
}
