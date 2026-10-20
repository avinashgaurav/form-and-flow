import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { checkLogFood } from '@ff/engines';
import { FOOD_DATA_NOTE, fmtPortion, fmtTotal, foodPrefs, MEAL_LABEL, mealsOn, mealTypeAt, numericMode, targetsFor, toMealItem, totalsOf } from '../../src/lib/food';
import { addDays, todayKey } from '../../src/lib/plan';
import { sentence } from '../../src/lib/limits';
import { newId, useStore } from '../../src/store/store';
import type { MealItem, MealLog, SavedMeal } from '../../src/store/types';
import { color, space } from '../../src/theme';
import { Banner, Button, Card, Chip, EmptyState, Eyebrow, Row, Screen, T } from '../../src/ui';

/** Nutrition today (S20) with saved meals (F-14) and recent history (S24). */
export default function Eat() {
  const { state, dispatch } = useStore();
  const tz = state.profile?.timezone ?? 'Asia/Kolkata';
  const today = todayKey(tz);
  const numeric = numericMode(state);
  const targets = targetsFor(state);
  const meals = mealsOn(state, today);
  const totals = totalsOf(meals.flatMap((m) => m.items));
  const [pendingSaved, setPendingSaved] = useState<SavedMeal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  function logSaved(saved: SavedMeal) {
    const now = new Date();
    // Values are computed now from the current catalogue; later edits never touch this log.
    const items = saved.items.map((i) => toMealItem(newId(), i.name, { food: i.food, quantity: i.quantity, unit: i.unit, oilLevel: i.oilLevel })).filter((x): x is MealItem => !!x);
    if (!items.length) return setNote('That saved meal has no foods we can size any more. Log it again by hand.');
    const dropped = saved.items.length - items.length;
    const meal: MealLog = { id: newId(), day: todayKey(tz, now), at: now.toISOString(), mealType: mealTypeAt(now), source: 'saved_meal', items };
    dispatch({ type: 'patch', patch: { meals: [...state.meals, meal] } });
    setPendingSaved(null);
    setNote(`Logged ${saved.name} as ${MEAL_LABEL[meal.mealType].toLowerCase()}.${dropped ? ` ${dropped} ${dropped === 1 ? 'food was' : 'foods were'} left out because we can no longer size ${dropped === 1 ? 'it' : 'them'}.` : ''}`);
  }

  function deleteMeal(id: string) {
    dispatch({ type: 'patch', patch: { meals: state.meals.filter((m) => m.id !== id) } });
    dispatch({ type: 'tombstone', keys: [`meal_logs:${id}`] });
    setConfirmDelete(null);
  }

  function forgetSaved(id: string) {
    dispatch({ type: 'patch', patch: { savedMeals: state.savedMeals.filter((m) => m.id !== id) } });
    dispatch({ type: 'tombstone', keys: [`saved_meals:${id}`] });
    setPendingSaved(null);
  }

  const earlier = [1, 2, 3, 4, 5, 6].map((n) => addDays(today, -n)).map((day) => ({ day, meals: mealsOn(state, day) })).filter((d) => d.meals.length);

  const mealCard = (m: MealLog, compact = false) => {
    const t = totalsOf(m.items);
    return (
      <Card key={m.id} tone={compact ? 'sunken' : 'surface'}>
        <Eyebrow>{MEAL_LABEL[m.mealType]}</Eyebrow>
        {m.items.map((i) => (
          <T key={i.id} v={compact ? 'small' : 'body'} style={compact ? { color: color.ink } : undefined}>{`${i.name}, ${fmtPortion(i.quantity, i.unit)}`}</T>
        ))}
        {numeric && t && <T v="small">{`${fmtTotal('energyKcal', t.energyKcal)} · ${fmtTotal('proteinG', t.proteinG)}`}</T>}
        {confirmDelete === m.id ? (
          <Row>
            <Button label="Delete meal" kind="danger" onPress={() => deleteMeal(m.id)} />
            <Button label="Keep" kind="ghost" onPress={() => setConfirmDelete(null)} />
          </Row>
        ) : (
          <Row>
            <Button label="Edit" kind="ghost" onPress={() => router.push({ pathname: '/meal', params: { edit: m.id } })} />
            <Button label="Delete" kind="ghost" onPress={() => setConfirmDelete(m.id)} />
          </Row>
        )}
      </Card>
    );
  };

  return (
    <Screen>
      <T v="title">Eat</T>
      <Button label="Log a meal" icon="plus" onPress={() => router.push('/meal')} />
      {note && <Banner tone="ok" title={note} />}

      <Card>
        <T v="h2">Today’s guide</T>
        {targets.mode === 'non_numeric' ? (
          <>
            {targets.plate.map((p) => (
              <T key={p.part}>{`${p.share === 'half' ? 'Half the plate' : 'A quarter'}: ${p.part.toLowerCase()} (${p.examples.join(', ')})`}</T>
            ))}
            <T v="small">{targets.proteinPerMeal}</T>
          </>
        ) : (
          <>
            {/* What you have eaten, next to what the guide suggests. */}
            <View style={{ gap: space.xs }}>
              <T v="label">Eaten so far today</T>
              <T v="h2">{totals ? fmtTotal('energyKcal', totals.energyKcal) : 'Nothing yet'}</T>
              <T v="small" style={{ color: color.ink }}>{targets.energy ? `Your guide: ${targets.energy.displayKcal.low.toLocaleString('en-IN')} to ${targets.energy.displayKcal.high.toLocaleString('en-IN')} kcal a day` : targets.energyReason ?? 'No energy guide.'}</T>
            </View>
            <View style={{ gap: space.xs }}>
              <T v="label">Protein</T>
              <T style={{ color: color.ink }}>
                {`${totals ? fmtTotal('proteinG', totals.proteinG) : 'Nothing yet'} · guide ${
                  targets.protein
                    ? targets.protein.kind === 'cap' ? `up to ${targets.protein.grams.high} g` : targets.protein.grams.high ? `${targets.protein.grams.low} to ${targets.protein.grams.high} g` : `at least ${targets.protein.grams.default} g`
                    : 'not set'
                }`}
              </T>
            </View>
          </>
        )}
        <Button label={showWhy ? 'Hide why' : 'Why this guide'} kind="ghost" onPress={() => setShowWhy(!showWhy)} />
        {showWhy && (
          <View style={{ gap: space.xs }}>
            {targets.reasons.map((r) => <T key={r.ruleId + r.text} v="small">{sentence(r.text)}</T>)}
            {targets.reasons.length === 0 && <T v="small">Built from your goal, body measurements and activity with the rules in this app.</T>}
            {targets.mode !== 'non_numeric' && <T v="small">{targets.fibre.note}</T>}
            <T v="small">{FOOD_DATA_NOTE}</T>
          </View>
        )}
      </Card>

      {state.savedMeals.length > 0 && (
        <Card>
          <T v="h2">Usual meals</T>
          <Row style={{ flexWrap: 'wrap' }}>
            {state.savedMeals.map((m) => <Chip key={m.id} label={m.name} selected={pendingSaved?.id === m.id} onPress={() => setPendingSaved(pendingSaved?.id === m.id ? null : m)} />)}
          </Row>
          {pendingSaved && (
            <View style={{ gap: space.sm }}>
              <T v="small" style={{ color: color.ink }}>{pendingSaved.items.map((i) => `${i.name}, ${fmtPortion(i.quantity, i.unit)}`).join('; ')}</T>
              {(() => {
                const flagged = pendingSaved.items.filter((i) => checkLogFood(i.food, foodPrefs(state)).warning).map((i) => i.name);
                return flagged.length ? <Banner tone="warn" title={`Contains something you listed as an allergy: ${flagged.join(', ')}`} body="You can still log what you ate." /> : null;
              })()}
              <Button label={`Log as ${MEAL_LABEL[mealTypeAt(new Date())].toLowerCase()}`} onPress={() => logSaved(pendingSaved)} />
              <Button label="Forget this usual meal" kind="ghost" onPress={() => forgetSaved(pendingSaved.id)} />
            </View>
          )}
        </Card>
      )}

      {meals.length === 0 ? (
        <EmptyState title="Nothing logged today" body={'Tap "Log a meal" and type something like "2 roti, dal, bhindi". A few meals is enough.'} />
      ) : (
        meals.map((m) => mealCard(m))
      )}

      {earlier.length > 0 && (
        <>
          <T v="h2">Earlier this week</T>
          {earlier.map((d) => (
            <View key={d.day} style={{ gap: space.sm }}>
              <T v="label">{new Date(`${d.day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</T>
              {d.meals.map((m) => mealCard(m, true))}
            </View>
          ))}
        </>
      )}

      <Button label="Food settings" kind="secondary" onPress={() => router.push('/food-settings')} />
    </Screen>
  );
}
