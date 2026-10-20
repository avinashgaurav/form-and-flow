import { displayWeight, inputWeightToKg, inRange, RANGES, trendSegments, weightPoints, weightTrendSummary, workoutsPerWeek, type WeightEntry } from '@ff/engines';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Bars, TrendChart } from '../../src/charts';
import { foodDays, numericMode, targetsFor } from '../../src/lib/food';
import { addDays, currentPlan, exerciseName, mondayOf, todayIndex, todayKey } from '../../src/lib/plan';
import { newId, useStore } from '../../src/store/store';
import { color, space } from '../../src/theme';
import { Bar, Banner, Button, Card, EmptyState, Field, Row, Screen, T } from '../../src/ui';

const WEEKDAY = (day: string) => 'MTWTFSS'[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]!;
const shortDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/** Progress dashboard (S25 to S27): only what was logged, no projections, weight only if chosen. */
export default function Progress() {
  const { state, dispatch } = useStore();
  const tz = state.profile?.timezone ?? 'Asia/Kolkata';
  const units = state.profile?.units ?? 'metric';
  const today = todayKey(tz);
  const plan = currentPlan(state);
  const planned = plan?.week.sessions.length ?? 0;
  const doneThisWeek = plan?.week.sessions.filter((s) => state.sessions[s.id]?.status === 'completed').length ?? 0;
  const dayIdx = todayIndex(state);
  const nextUp = plan?.week.sessions.find((s) => s.day >= dayIdx && state.sessions[s.id]?.status !== 'completed' && state.sessions[s.id]?.status !== 'partial');
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // The one line to read: where the week stands and what is next.
  const headline = planned === 0
    ? 'No workouts planned this week.'
    : doneThisWeek >= planned
      ? `All ${planned} workouts done this week. Nice work.`
      : `${doneThisWeek} of ${planned} workouts done this week.${nextUp ? ` Next: ${nextUp.day === dayIdx ? 'today' : DAYS[nextUp.day]}.` : ''}`;
  const last7 = [6, 5, 4, 3, 2, 1, 0].map((n) => addDays(today, -n));
  const food = foodDays(state, last7);
  const numeric = numericMode(state);
  const targets = targetsFor(state);

  // Workouts per week, from the day each completed session started.
  const completedDays = Object.values(state.sessions)
    .filter((s) => s.status === 'completed')
    .map((s) => todayKey(tz, new Date(s.startedAt)));
  const weeks = workoutsPerWeek(completedDays, mondayOf(today), 8);

  // Weight: never offered when the safety answers turned on plate-only guidance.
  const weightAllowed = !state.restrictions.some((r) => r.code === 'non_numeric_only');
  const tracking = weightAllowed && state.tracking.weight;
  const points = weightPoints(state.weights);
  const trend = weightTrendSummary(points);
  const show = (kg: number) => {
    const d = displayWeight(kg, units);
    return `${d.value} ${d.unit}`;
  };

  const [weightText, setWeightText] = useState('');
  const [tried, setTried] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  // Plain decimals only ("79.5" or "79,5"); anything else is not a weight.
  const kg = /^\d{1,3}([.,]\d{1,2})?$/.test(weightText.trim()) ? inputWeightToKg(Number(weightText.trim().replace(',', '.')), units) : NaN;
  const invalid = !inRange(kg, RANGES.weightKg);
  // Shown only after Save is tapped, so typing "7" on the way to "79" is not an error.
  const weightError = tried && invalid ? (units === 'imperial' ? 'Enter a weight between 67 and 551 lb.' : 'Enter a weight between 30 and 250 kg.') : undefined;

  function saveWeight() {
    setTried(true);
    if (!weightText || invalid) return;
    setTried(false);
    const value = Math.round(kg * 10) / 10;
    if (editing) {
      dispatch({ type: 'patch', patch: { weights: state.weights.map((w) => (w.id === editing ? { ...w, kg: value, updatedAt: new Date().toISOString() } : w)) } });
    } else {
      const now = new Date();
      const entry: WeightEntry = { id: newId(), kg: value, at: now.toISOString(), day: todayKey(tz, now), updatedAt: now.toISOString() };
      dispatch({ type: 'patch', patch: { weights: [...state.weights, entry] } });
    }
    setWeightText('');
    setEditing(null);
  }

  function deleteWeight(id: string) {
    dispatch({ type: 'patch', patch: { weights: state.weights.filter((w) => w.id !== id) } });
    dispatch({ type: 'tombstone', keys: [`progress_entries:${id}`] });
    setConfirmDelete(null);
    if (editing === id) (setEditing(null), setWeightText(''));
  }

  function deleteAllWeights() {
    dispatch({ type: 'tombstone', keys: state.weights.map((w) => `progress_entries:${w.id}`) });
    dispatch({ type: 'patch', patch: { weights: [] } });
    setConfirmDeleteAll(false);
  }

  const lined = trendSegments(points);
  const latestTrend = points.length && lined.has(points[points.length - 1]!.segment) ? points[points.length - 1]!.trendKg : undefined;
  const offerProfileUpdate = latestTrend !== undefined && trend.status === 'ok' && Math.abs((state.profile?.weightKg ?? latestTrend) - latestTrend) >= 1;

  // Strength history (S27): best logged set per exercise.
  const byExercise = new Map<string, { best: { reps: number; loadKg: number }; sessions: Set<string>; lastAt: string }>();
  for (const s of state.sets) {
    const cur = byExercise.get(s.exerciseId);
    const better = !cur || s.loadKg > cur.best.loadKg || (s.loadKg === cur.best.loadKg && s.reps > cur.best.reps);
    byExercise.set(s.exerciseId, {
      best: better ? { reps: s.reps, loadKg: s.loadKg } : cur!.best,
      sessions: new Set([...(cur?.sessions ?? []), s.sessionKey]),
      lastAt: !cur || s.at > cur.lastAt ? s.at : cur.lastAt,
    });
  }
  const rows = [...byExercise.entries()].sort((a, b) => b[1].lastAt.localeCompare(a[1].lastAt));

  const mealDays = food.filter((d) => d.meals > 0).length;
  const checkInDays = last7.filter((d) => state.checkIns[d]).length;
  // Only fuller days (two or more meals, no missing values), so light logging does not read as low intake.
  const fullDays = food.filter((d) => d.meals >= 2 && !d.partial);
  const avgProtein = fullDays.length ? Math.round(fullDays.reduce((n, d) => n + (d.proteinG ?? 0), 0) / fullDays.length) : null;

  return (
    <Screen>
      <T v="title">Progress</T>
      <T v="h2">{headline}</T>

      <Card>
        <T v="h2">This week</T>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="small">Sessions done</T>
          <T v="num">{`${doneThisWeek} of ${planned}`}</T>
        </Row>
        <View accessibilityLabel={`${doneThisWeek} of ${planned} sessions done this week`}>
          <Bar value={planned ? doneThisWeek / planned : 0} />
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="small">Days with food logged (last 7)</T>
          <T v="num">{String(mealDays)}</T>
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="small">Check-ins (last 7 days)</T>
          <T v="num">{String(checkInDays)}</T>
        </Row>
        <Button label="Weekly review" kind="secondary" onPress={() => router.push('/review')} />
      </Card>

      <Card>
        <T v="h2">Workouts per week</T>
        <Bars
          bars={weeks.map((w) => ({ label: shortDate(w.weekStart).split(' ')[0]!, value: w.count }))}
          summary={`Completed workouts per week, last 8 weeks: ${weeks.map((w) => `week of ${shortDate(w.weekStart)}, ${w.count}`).join('; ')}.`}
        />
        <T v="small">Each bar is one week, labelled with the date its Monday falls on.</T>
      </Card>

      <Card>
        <T v="h2">Food, last 7 days</T>
        {mealDays === 0 ? (
          <T v="small">Nothing logged in the last 7 days. Log some meals on the Eat tab to see this fill in.</T>
        ) : numeric && targets.mode === 'numeric' ? (
          <>
            <Bars
              bars={food.map((d) => ({ label: WEEKDAY(d.day), value: d.energyKcal, faded: d.meals < 2 || d.partial }))}
              band={targets.energy ? [targets.energy.displayKcal.low, targets.energy.displayKcal.high] : undefined}
              summary={`Logged energy per day: ${food.map((d) => `${shortDate(d.day)}, ${d.energyKcal === null ? 'nothing logged' : `${d.energyKcal} kcal`}`).join('; ')}.`}
            />
            <T v="small">{targets.energy ? 'Green band: your guide. Pale bars: days only partly logged.' : 'Pale bars: days only partly logged.'}</T>
            {avgProtein !== null && (
              <T v="small" style={{ color: color.ink }}>
                {`Protein on fully logged days: about ${avgProtein} g${targets.protein?.grams.high ? ` (guide ${targets.protein.grams.low} to ${targets.protein.grams.high} g)` : ''}.`}
              </T>
            )}
          </>
        ) : (
          <>
            <Bars bars={food.map((d) => ({ label: WEEKDAY(d.day), value: d.meals }))} summary={`Meals logged per day: ${food.map((d) => `${shortDate(d.day)}, ${d.meals}`).join('; ')}.`} />
            <T v="small">Meals logged per day. Plate guidance is on, so no calorie numbers are shown.</T>
          </>
        )}
      </Card>

      {weightAllowed && !tracking && (
        <Card tone="sunken">
          <T v="h2">Weight</T>
          <T v="small" style={{ color: color.ink }}>Optional. If you track it, you see a smoothed trend, never a forecast. Daily ups and downs are normal.</T>
          <Button label="Track my weight" kind="secondary" onPress={() => dispatch({ type: 'patch', patch: { tracking: { ...state.tracking, weight: true } } })} />
          {state.weights.length > 0 && !confirmDeleteAll && (
            <Button label={`Delete all ${state.weights.length} saved weigh-ins`} kind="ghost" onPress={() => setConfirmDeleteAll(true)} />
          )}
          {confirmDeleteAll && (
            <Row>
              <Button label="Delete all" kind="danger" onPress={deleteAllWeights} />
              <Button label="Keep" kind="ghost" onPress={() => setConfirmDeleteAll(false)} />
            </Row>
          )}
        </Card>
      )}

      {tracking && (
        <Card>
          <T v="h2">Weight</T>
          {points.length > 1 ? (
            <TrendChart
              points={points.map((p) => ({
                x: daysBetween(points[0]!.day, p.day),
                value: displayWeight(p.kg, units).value,
                trend: lined.has(p.segment) ? displayWeight(p.trendKg, units).value : null,
                segment: p.segment,
              }))}
              firstLabel={shortDate(points[0]!.day)}
              lastLabel={shortDate(points[points.length - 1]!.day)}
              summary={`${points.length} weigh-in days from ${shortDate(points[0]!.day)} to ${shortDate(points[points.length - 1]!.day)}, latest ${show(points[points.length - 1]!.kg)}.${latestTrend !== undefined ? ` Trend ${show(latestTrend)}.` : ''}`}
            />
          ) : (
            <T v="small">Add a few weigh-ins to see a chart.</T>
          )}
          <T v="small" style={{ color: color.ink }}>
            {trend.status === 'too_early'
              ? 'A trend appears after a week of weigh-ins.'
              : `Trend over ${trend.days} days: ${trend.changeKg === 0 ? 'steady' : `${trend.changeKg < 0 ? 'down' : 'up'} ${show(Math.abs(trend.changeKg))}`}. The blue line smooths daily ups and downs; dots are your entries.`}
          </T>
          {offerProfileUpdate && (
            <Button label={`Use ${show(latestTrend!)} for your food guide`} kind="secondary" onPress={() => state.profile && dispatch({ type: 'patch', patch: { profile: { ...state.profile, weightKg: latestTrend } } })} />
          )}
          <Field
            label={editing ? `Change entry (${units === 'imperial' ? 'lb' : 'kg'})` : `Today's weight (${units === 'imperial' ? 'lb' : 'kg'})`}
            value={weightText}
            onChangeText={setWeightText}
            keyboardType="numeric"
            error={weightError}
          />
          <Row>
            <Button label={editing ? 'Save change' : 'Add weigh-in'} onPress={saveWeight} disabled={!weightText.trim()} />
            {editing && <Button label="Cancel" kind="ghost" onPress={() => (setEditing(null), setTried(false), setWeightText(''))} />}
          </Row>
          {[...state.weights].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, showAll ? undefined : 6).map((w) => (
            <View key={w.id} style={{ gap: space.xs }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="small" style={{ color: color.ink }}>{`${shortDate(w.day)}, ${new Date(w.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}: ${show(w.kg)}`}</T>
                <Row gap={space.xs}>
                  <Button label="Edit" kind="ghost" accessibilityHint={`Edit the weigh-in of ${shortDate(w.day)}`} onPress={() => (setEditing(w.id), setTried(false), setWeightText(String(displayWeight(w.kg, units).value)))} />
                  <Button label="Delete" kind="ghost" accessibilityHint={`Delete the weigh-in of ${shortDate(w.day)}`} onPress={() => setConfirmDelete(w.id)} />
                </Row>
              </Row>
              {confirmDelete === w.id && (
                <Row>
                  <Button label="Delete entry" kind="danger" onPress={() => deleteWeight(w.id)} />
                  <Button label="Keep" kind="ghost" onPress={() => setConfirmDelete(null)} />
                </Row>
              )}
            </View>
          ))}
          {state.weights.length > 6 && <Button label={showAll ? 'Show fewer' : `Show all ${state.weights.length} entries`} kind="ghost" onPress={() => setShowAll(!showAll)} />}
          <Button label="Stop tracking weight" kind="ghost" onPress={() => dispatch({ type: 'patch', patch: { tracking: { ...state.tracking, weight: false } } })} />
          <T v="small">Stopping hides weight everywhere. Your entries are kept (and backed up, if backup is on) until you delete them.</T>
        </Card>
      )}
      {!weightAllowed && state.weights.length > 0 && <Banner tone="info" title="Weight is hidden" body="Your safety answers turned on plate guidance, so weight is not shown." />}

      <T v="label">Strength history</T>
      {rows.length === 0 ? (
        <EmptyState title="Nothing logged yet" body="Your best sets appear here after your first session. Only sets you logged are shown; nothing is projected." />
      ) : (
        rows.map(([id, r]) => (
          <Card key={id}>
            <T v="h2">{exerciseName(id)}</T>
            <View style={{ gap: space.xs }}>
              <T v="small" style={{ color: color.ink }}>{`Best logged set: ${r.best.reps}${r.best.loadKg ? ` × ${r.best.loadKg} kg` : ' reps'}`}</T>
              <T v="small">{`${r.sessions.size} session${r.sessions.size === 1 ? '' : 's'}`}</T>
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
