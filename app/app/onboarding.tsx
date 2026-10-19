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
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { deviceTimeZone, makePlan, plural } from '../src/lib/plan';
import { useStore } from '../src/store/store';
import { AI_NOTICE, NOTICE_VERSION, emptyDraft, type AppState, type Profile } from '../src/store/types';
import { color, space } from '../src/theme';
import { Banner, Button, Card, Chip, ChipGroup, Eyebrow, Field, Row, Screen, Stepper, T } from '../src/ui';

const STEPS = ['Welcome', 'Age and consent', 'Goal', 'Baseline', 'Safety questions', 'Safety result', 'Training', 'Coaching', 'Your week'];

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
const toggle = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export default function Onboarding() {
  const { state, dispatch } = useStore();
  const d = state.draft;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [blocked, setBlocked] = useState(false);

  if (state.onboarded) return <Redirect href="/" />;

  const set = (patch: Partial<AppState['draft']>) => dispatch({ type: 'draft', patch });
  const go = (step: number) => {
    setErrors({});
    set({ step });
  };

  const readiness = assessReadiness({ answers: d.answers, regions: d.regions, medicalClearanceConfirmed: d.clearance });
  const medicalYes = (['R4', 'R5', 'R6', 'R10'] as QuestionId[]).some((q) => d.answers[q] === 'yes' || d.answers[q] === 'not_sure');

  function next() {
    const e: Record<string, string> = {};
    if (d.step === 1) {
      const y = Number(d.birthYear);
      if (!/^\d{4}$/.test(d.birthYear ?? '')) e.birthYear = 'Enter the year you were born, for example 1994.';
      else if (thisYear - y < 18) {
        setBlocked(true);
        dispatch({ type: 'patch', patch: { draft: emptyDraft() } });
        return;
      } else if (thisYear - y > 100) e.birthYear = 'Please check the year.';
      if (!d.consentCore) e.consent = 'This is needed to build and save your plan.';
    }
    if (d.step === 2 && !d.goal) e.goal = 'Pick the goal that matters most right now.';
    if (d.step === 3) {
      const h = Number(d.heightCm);
      if (!inRange(h, RANGES.heightCm)) e.height = 'Height should be between 120 and 220 cm.';
      if (d.weightKg && !inRange(Number(d.weightKg), RANGES.weightKg)) e.weight = 'Weight should be between 30 and 250 kg.';
      if (!d.experience) e.experience = 'Choose your training experience.';
    }
    if (d.step === 4) {
      if (readiness.missing.length) e.readiness = 'Please answer every question. "Not sure" is fine.';
      if (d.answers.R8 === 'yes' && d.regions.length === 0) e.regions = 'Choose the area that is affected.';
      if (medicalYes && d.clearance === undefined) e.clearance = 'Please answer the clearance question.';
    }
    if (d.step === 6) {
      if (!d.location) e.location = 'Where will you train?';
      if (d.days.length === 0) e.days = 'Choose at least one day.';
    }
    if (d.step === 7 && !d.tone) e.tone = 'Choose how your coach should talk to you.';
    if (Object.keys(e).length) return setErrors(e);

    if (d.step === 4 && readiness.disposition === 'clear') return go(6);
    if (d.step === 7) return buildPlan();
    go(d.step + 1);
  }

  function back() {
    if (d.step === 6 && readiness.disposition === 'clear') return go(4);
    go(Math.max(0, d.step - 1));
  }

  function buildPlan() {
    const profile: Profile = {
      birthYear: Number(d.birthYear),
      units: d.units,
      tone: d.tone!,
      timezone: deviceTimeZone(),
      goal: d.goal!,
      heightCm: Number(d.heightCm),
      weightKg: d.weightKg ? Number(d.weightKg) : undefined,
      activity: d.activity,
      training: { goal: d.goal!, experience: d.experience!, location: d.location!, equipment: d.equipment, daysAvailable: [...d.days].sort(), sessionMinutes: d.minutes },
    };
    const now = new Date().toISOString();
    const next: AppState = {
      ...state,
      profile,
      consents: { core: true, aiProcessing: !!d.consentAi, version: NOTICE_VERSION, at: now },
      readiness: { answers: d.answers, regions: d.regions, clearance: !!d.clearance, result: readiness, at: now },
      restrictions: readiness.restrictions,
    };
    dispatch({ type: 'patch', patch: { profile: next.profile, consents: next.consents, readiness: next.readiness, restrictions: next.restrictions, plan: makePlan(next, 1) } });
    go(8);
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

  const progress = `Step ${Math.min(d.step + 1, STEPS.length)} of ${STEPS.length}`;

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
          <Banner tone="warn" title="Draft content" body="Exercises and rules in this build are drafts that a qualified coach has not reviewed yet. It is for the founder pilot only." />
          <Button label="Get started" onPress={() => go(1)} tall />
        </View>
      )}

      {d.step === 1 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">About you</T>
          <Field label="Year of birth" keyboardType="numeric" value={d.birthYear ?? ''} onChangeText={(t) => set({ birthYear: t.replace(/\D/g, '').slice(0, 4) })} placeholder="1994" hint="This app is for adults. We keep only the year." error={errors.birthYear} />
          <Card>
            <T v="h2">How we use your data</T>
            <T v="small">We store your profile, safety answers and logs on this phone to build and adjust your plan. If you turn on backup, a copy is kept in your account. You can export or delete it in Settings at any time.</T>
            <Chip label={d.consentCore ? 'Agreed' : 'I agree (required)'} selected={!!d.consentCore} onPress={() => set({ consentCore: !d.consentCore })} accessibilityLabel="I agree to the data use described above" />
            {errors.consent && <T v="small" style={{ color: color.danger }}>{errors.consent}</T>}
          </Card>
          <Card>
            <T v="h2">AI coach (optional)</T>
            <T v="small">{AI_NOTICE}</T>
            <Chip label={d.consentAi ? 'Allowed' : 'Not allowed'} selected={!!d.consentAi} onPress={() => set({ consentAi: !d.consentAi })} accessibilityLabel="Allow the AI coach" />
          </Card>
          <Button label="Continue" onPress={next} tall />
        </View>
      )}

      {d.step === 2 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">What matters most right now?</T>
          <T v="small">Your goal decides how your week is built. You can change it later.</T>
          <ChipGroup options={GOALS} value={d.goal} onChange={(goal) => set({ goal })} />
          {errors.goal && <T v="small" style={{ color: color.danger }}>{errors.goal}</T>}
          <Button label="Continue" onPress={next} tall />
        </View>
      )}

      {d.step === 3 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">A few basics</T>
          <Field label="Height (cm)" keyboardType="numeric" value={d.heightCm ?? ''} onChangeText={(t) => set({ heightCm: t.replace(/[^\d.]/g, '') })} placeholder="170" error={errors.height} />
          <Field label="Weight (kg, optional)" keyboardType="numeric" value={d.weightKg ?? ''} onChangeText={(t) => set({ weightKg: t.replace(/[^\d.]/g, '') })} placeholder="Skip if you prefer" hint="Only used for estimates. Leave it blank if you would rather not track weight." error={errors.weight} />
          {d.heightCm && d.weightKg && needsPlausibilityCheck(Number(d.heightCm), Number(d.weightKg)) && (
            <Banner tone="warn" title="Please double-check" body="That height and weight combination is unusual. If it is right, carry on." />
          )}
          <T v="label">Training experience</T>
          <ChipGroup
            options={[
              { value: 'none', label: 'New to it' },
              { value: 'lt6m', label: 'Under 6 months' },
              { value: '6to24m', label: '6 to 24 months' },
              { value: 'gt2y', label: '2+ years' },
            ]}
            value={d.experience}
            onChange={(experience) => set({ experience })}
          />
          {errors.experience && <T v="small" style={{ color: color.danger }}>{errors.experience}</T>}
          <T v="label">Day-to-day activity</T>
          <ChipGroup
            options={[
              { value: 'low', label: 'Mostly sitting' },
              { value: 'light', label: 'Some walking' },
              { value: 'moderate', label: 'On my feet a lot' },
              { value: 'high', label: 'Physical work' },
            ]}
            value={d.activity}
            onChange={(activity) => set({ activity })}
          />
          <Button label="Continue" onPress={next} tall />
        </View>
      )}

      {d.step === 4 && (
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

      {d.step === 5 && (
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

      {d.step === 6 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">Your training setup</T>
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
          <Button label="Continue" onPress={next} tall />
        </View>
      )}

      {d.step === 7 && (
        <View style={{ gap: space.lg }}>
          <T v="h1">How should your coach talk?</T>
          <ChipGroup
            options={[
              { value: 'gentle', label: 'Gentle and encouraging' },
              { value: 'direct', label: 'Short and direct' },
              { value: 'data', label: 'Numbers first' },
            ]}
            value={d.tone}
            onChange={(tone) => set({ tone })}
          />
          {errors.tone && <T v="small" style={{ color: color.danger }}>{errors.tone}</T>}
          <T v="small">Tone changes wording only. It never changes safety rules. Reminders are not part of this build.</T>
          <Button label="Build my week" onPress={next} tall />
        </View>
      )}

      {d.step === 8 && state.plan && <Preview onAccept={accept} onEdit={() => go(6)} />}
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
          <T key={r.ruleId + r.text} v="small" style={{ color: color.ink }}>{`${r.text} (${r.ruleId})`}</T>
        ))}
      </Card>
      {week.needsReview.length > 0 && <Banner tone="warn" title="Not yet reviewed" body={`These rules still need a qualified reviewer: ${week.needsReview.join('; ')}.`} />}
      <Button label="Accept and start" onPress={onAccept} tall />
      <Button label="Change my setup" kind="secondary" onPress={onEdit} />
    </View>
  );
}
