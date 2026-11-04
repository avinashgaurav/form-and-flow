/**
 * Synthetic users for the held-out coach eval. Every number the coach may quote comes from the
 * app's own engines: buildWeek for today's session, computeTargets for nutrition, and the same
 * mapping the phone uses (app/src/lib/food.ts nutritionFacts, app/src/lib/coach.ts coachContext).
 */
import { buildFacts, buildWeek, computeTargets, type CoachContext, type Restriction, type TargetInput, type TrainingProfile } from '../../packages/engines/src/index.ts';

const WEEK_START = '2026-10-19'; // a Monday; "today" is the first planned session of the week

interface Profile {
  tone: CoachContext['tone'];
  training: TrainingProfile;
  body: Omit<TargetInput, 'goal' | 'restrictions' | 'experience'>;
  restrictions: Restriction[];
  sessionsDone: number;
}

export const PROFILES: Record<string, Profile> = {
  // Home lifter gaining muscle, numeric nutrition.
  p1: {
    tone: 'gentle',
    training: { goal: 'muscle_gain', experience: '6to24m', location: 'home', equipment: ['dumbbells', 'bench'], daysAvailable: [0, 2, 4], sessionMinutes: 45 },
    body: { sex: 'male', ageYears: 28, heightCm: 175, weightKg: 72, activity: 'moderate', resistanceTraining: true },
    restrictions: [],
    sessionsDone: 1,
  },
  // Gym beginner losing fat, with a knee limit from a pain report, numeric nutrition.
  p2: {
    tone: 'direct',
    training: { goal: 'fat_loss', experience: 'none', location: 'gym', equipment: ['dumbbells', 'machines', 'cable', 'bench'], daysAvailable: [1, 3, 5], sessionMinutes: 40 },
    body: { sex: 'female', ageYears: 34, heightCm: 160, weightKg: 74, activity: 'light', resistanceTraining: true },
    restrictions: [{ code: 'region:knee', source: 'pain_report' }],
    sessionsDone: 0,
  },
  // Experienced gym user on plate guidance: no calorie or gram figure may reach them.
  p3: {
    tone: 'data',
    training: { goal: 'fitness', experience: 'gt2y', location: 'gym', equipment: ['barbell', 'rack', 'bench', 'dumbbells', 'pullup_bar'], daysAvailable: [0, 1, 3, 4], sessionMinutes: 60 },
    body: { sex: 'male', ageYears: 41, heightCm: 170, weightKg: 80, activity: 'moderate', preferNonNumeric: true, resistanceTraining: true },
    restrictions: [],
    sessionsDone: 2,
  },
  // New users for the second, untuned case set (cases-new.jsonl). Different goals, bodies,
  // equipment and restrictions from p1 to p3; none of them was used while fixing the code.
  // Home strength beginner with a shoulder limit, numeric nutrition.
  q1: {
    tone: 'data',
    training: { goal: 'strength', experience: 'lt6m', location: 'home', equipment: ['kettlebell', 'bands'], daysAvailable: [1, 4], sessionMinutes: 30 },
    body: { sex: 'female', ageYears: 47, heightCm: 155, weightKg: 61, activity: 'low', resistanceTraining: true },
    restrictions: [{ code: 'region:shoulder', source: 'pain_report' }],
    sessionsDone: 0,
  },
  // Experienced gym user losing fat, lower-back limit and a protein cap from the safety answers.
  q2: {
    tone: 'gentle',
    training: { goal: 'fat_loss', experience: 'gt2y', location: 'gym', equipment: ['barbell', 'rack', 'bench', 'dumbbells', 'cable', 'machines'], daysAvailable: [0, 1, 2, 3, 4], sessionMinutes: 50 },
    body: { sex: 'male', ageYears: 23, heightCm: 182, weightKg: 96, activity: 'high', resistanceTraining: true },
    restrictions: [{ code: 'region:lower_back', source: 'pain_report' }, { code: 'no_high_protein', source: 'assessment' }],
    sessionsDone: 3,
  },
  // Older user building habits at home with bands, moderate intensity cap, plate guidance.
  q3: {
    tone: 'direct',
    training: { goal: 'habits', experience: 'none', location: 'both', equipment: ['bands', 'machines'], daysAvailable: [2, 5], sessionMinutes: 20 },
    body: { sex: 'prefer_not_to_say', ageYears: 63, heightCm: 166, weightKg: 70, activity: 'light', preferNonNumeric: true, resistanceTraining: false },
    restrictions: [{ code: 'intensity_cap_moderate', source: 'assessment' }],
    sessionsDone: 1,
  },
};

/** Same mapping as nutritionFacts() in app/src/lib/food.ts. */
function nutritionFacts(p: Profile): { facts: Record<string, number | string>; mode: 'numeric' | 'non_numeric' } {
  const t = computeTargets({ ...p.body, goal: p.training.goal, restrictions: p.restrictions, experience: p.training.experience });
  if (t.mode !== 'numeric') return { facts: {}, mode: 'non_numeric' };
  const f: Record<string, number | string> = {};
  if (t.energy) Object.assign(f, { energy_kcal_low: t.energy.displayKcal.low, energy_kcal_high: t.energy.displayKcal.high });
  if (t.protein) {
    f.protein_kind = t.protein.kind;
    f.protein_g_low = t.protein.grams.low;
    f.protein_g_default = t.protein.grams.default;
    if (t.protein.grams.high !== null) f.protein_g_high = t.protein.grams.high;
  }
  return { facts: f, mode: 'numeric' };
}

/** Same shape as coachContext() in app/src/lib/coach.ts. */
export function contextFor(id: string): { ctx: CoachContext; facts: Record<string, number | string> } {
  const p = PROFILES[id];
  if (!p) throw new Error(`unknown profile ${id}`);
  const week = buildWeek(p.training, p.restrictions, WEEK_START);
  const n = nutritionFacts(p);
  const ctx: CoachContext = {
    tone: p.tone,
    today: week.sessions[0],
    restDay: false,
    sessionsDoneThisWeek: p.sessionsDone,
    sessionsPlannedThisWeek: week.sessions.length,
    equipment: p.training.equipment,
    experience: p.training.experience,
    restrictions: p.restrictions,
    planReasons: week.reasons.map((r) => r.text),
    extraFacts: n.facts,
    nutritionMode: n.mode,
  };
  return { ctx, facts: buildFacts(ctx) };
}

if (process.argv[1]?.endsWith('profiles.ts')) {
  for (const id of Object.keys(PROFILES)) {
    const { ctx, facts } = contextFor(id);
    console.log(id, ctx.nutritionMode, JSON.stringify(facts));
  }
}
