import {
  checkLogFood,
  getCard,
  draftToLogItem,
  getFood,
  itemTotals,
  parseMealText,
  searchFoods,
  sumTotals,
  type ExclusionReason,
  type FoodRef,
  type FoodUnit,
  type OilLevel,
} from '@ff/engines';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { FOOD_DATA_NOTE, fmtPortion, fmtTotal, foodPrefs, hasOilChoice, MEAL_LABEL, MEAL_ORDER, mealTypeAt, numericMode, toMealItem, UNIT_LABEL, unitsFor } from '../src/lib/food';
import { backendConfigured } from '../src/lib/backend';
import { photoToDrafts } from '../src/lib/photo';
import { todayKey } from '../src/lib/plan';
import { newId, useStore } from '../src/store/store';
import { AI_NOTICE, NOTICE_VERSION } from '../src/store/types';
import type { MealItem, MealLog, MealType, SavedMeal } from '../src/store/types';
import { color, space } from '../src/theme';
import { Banner, Button, Card, Chip, ChipGroup, Eyebrow, Field, Row, Screen, Stepper, T } from '../src/ui';

/** Meal builder (S21 to S23): type it or search, check each item, then Save. Nothing is stored before Save (F-13). */

interface Draft {
  key: string;
  text: string;
  food?: FoodRef & { name: string };
  quantity: number;
  unit: FoodUnit | null;
  oilLevel?: OilLevel;
  confidence: 'high' | 'low';
  from: 'search' | 'text_parse' | 'photo';
  existing?: MealItem;
}

const OIL: { value: OilLevel | 'unsure'; label: string }[] = [
  { value: 'unsure', label: 'Not sure' },
  { value: 'light', label: 'Light oil' },
  { value: 'normal', label: 'Normal' },
  { value: 'rich', label: 'Rich' },
];

const ALLERGEN_LABEL: Record<string, string> = {
  milk: 'milk', gluten: 'gluten', peanut: 'peanut', tree_nut: 'tree nuts', soy: 'soy', egg: 'egg', fish: 'fish', shellfish: 'shellfish', sesame: 'sesame', mustard: 'mustard',
};

function reasonText(r: ExclusionReason): string | null {
  if (r.code === 'allergen') return `${ALLERGEN_LABEL[r.tag] ?? r.tag}${r.optional ? ' (sometimes added)' : ''}`;
  if (r.code === 'free_text') return `${r.text}${r.optional ? ' (sometimes added)' : ''}`;
  return null;
}

const isMeasured = (u: FoodUnit | null) => u === 'g' || u === 'ml';

export default function MealBuilder() {
  const { state, dispatch } = useStore();
  const params = useLocalSearchParams<{ edit?: string; type?: MealType }>();
  const editing = params.edit ? state.meals.find((m) => m.id === params.edit) : undefined;
  const numeric = numericMode(state);
  const prefs = foodPrefs(state);

  const [mealType, setMealType] = useState<MealType>(editing?.mealType ?? params.type ?? mealTypeAt(new Date()));
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [remember, setRemember] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoNote, setPhotoNote] = useState<{ tone: 'info' | 'warn' | 'ok'; title: string } | null>(null);
  // Photo logging needs the AI server: sign-in and AI consent.
  const photoBlocker = !backendConfigured
    ? 'Photo logging needs the AI server, which is not set up in this build yet. Type or search instead.'
    : !state.account
      ? 'Turn on backup in Settings to use photo logging.'
      : !state.consents?.aiProcessing
        ? 'Allow AI processing in Settings to use photo logging.'
        : null;

  // Photos were added to the notice later: anyone who agreed to an older one is asked once first.
  const [askPhotoConsent, setAskPhotoConsent] = useState<'camera' | 'library' | null>(null);
  function agreePhotos() {
    if (!state.consents || !askPhotoConsent) return;
    const source = askPhotoConsent;
    dispatch({ type: 'patch', patch: { consents: { ...state.consents, version: NOTICE_VERSION, at: new Date().toISOString() } } });
    setAskPhotoConsent(null);
    void fromPhoto(source, true);
  }

  async function fromPhoto(source: 'camera' | 'library', agreed = false) {
    if (!agreed && state.consents?.version !== NOTICE_VERSION) return setAskPhotoConsent(source);
    setPhotoBusy(true);
    setPhotoNote(null);
    try {
      const r = await photoToDrafts(source, state.coachModel);
      if (r.kind === 'drafts') {
        setDrafts((d) => [...d, ...r.drafts.map((p) => ({ key: newId(), text: p.unmatched ? p.foodText : p.text, food: p.match, quantity: p.quantity, unit: p.unit, confidence: p.confidence, from: 'photo' as const }))]);
        setPhotoNote({ tone: 'info', title: `Found ${r.drafts.length} ${r.drafts.length === 1 ? 'food' : 'foods'}. Check each one and the amounts.` });
      } else if (r.kind === 'not_food') setPhotoNote({ tone: 'warn', title: 'No food found in that photo. Try another, or type the meal.' });
      else if (r.kind === 'error') setPhotoNote({ tone: 'warn', title: r.message });
    } catch {
      setPhotoNote({ tone: 'warn', title: 'Something went wrong with the photo. Type the meal instead.' });
    } finally {
      setPhotoBusy(false);
    }
  }
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    (editing?.items ?? []).map((i) => ({ key: i.id, text: i.name, food: { ...i.food, name: i.name }, quantity: i.quantity, unit: i.unit, oilLevel: i.oilLevel, confidence: 'high', from: 'search', existing: i })),
  );

  const results = useMemo(() => (query.trim().length >= 2 ? searchFoods(query, { limit: 8 }) : []), [query]);

  const update = (key: string, patch: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const remove = (key: string) => setDrafts((d) => d.filter((x) => x.key !== key));

  function parse() {
    const parsed = parseMealText(text);
    setDrafts((d) => [
      ...d,
      ...parsed.map((p) => ({
        key: newId(),
        text: p.unmatched ? p.foodText : p.text,
        food: p.match,
        quantity: p.quantity,
        unit: p.unit,
        confidence: p.confidence,
        from: 'text_parse' as const,
      })),
    ]);
    setText('');
  }

  function addFromSearch(ref: FoodRef & { name: string }) {
    const f = getFood(ref);
    setDrafts((d) => [...d, { key: newId(), text: ref.name, food: { kind: ref.kind, id: ref.id, name: ref.name }, quantity: 1, unit: f?.defaultUnit ?? 'g', confidence: 'high', from: 'search' }]);
    setQuery('');
  }

  const valid = drafts.map((d) => {
    const item = d.food ? draftToLogItem({ text: d.text, foodText: d.text, match: d.food, quantity: d.quantity, unit: d.unit, confidence: d.confidence }, d.oilLevel) : null;
    let totals: ReturnType<typeof itemTotals> | null = null;
    try {
      totals = item ? itemTotals(item) : null;
    } catch {
      totals = null; // an amount the engine refuses shows as "needs fixing", never a crash
    }
    return { d, item, totals };
  });
  const problems = valid.filter((v) => !v.item || !v.totals?.grams).length;
  const ready = valid.filter((v) => v.totals?.grams);
  const sum = ready.length ? sumTotals(ready.map((v) => v.totals!)) : null;

  function save() {
    if (problems || drafts.length === 0) return;
    const items: MealItem[] = [];
    for (const v of valid) {
      const prev = v.d.existing;
      const same = prev && prev.quantity === v.d.quantity && prev.unit === v.d.unit && prev.oilLevel === v.d.oilLevel;
      // Unchanged items keep the numbers they were logged with (EC-33).
      const item = same ? prev : toMealItem(newId(), v.d.food!.name, v.item!);
      if (item) items.push(item);
    }
    const tz = state.profile?.timezone ?? 'Asia/Kolkata';
    const now = new Date();
    const source: MealLog['source'] = drafts.some((d) => d.from === 'photo') ? 'photo' : drafts.some((d) => d.from === 'text_parse') ? 'text_parse' : 'search';
    const meal: MealLog = editing
      ? { ...editing, mealType, items, updatedAt: now.toISOString() }
      : { id: newId(), day: todayKey(tz, now), at: now.toISOString(), mealType, source, items };
    const removedItems = (editing?.items ?? []).filter((i) => !items.some((x) => x.id === i.id)).map((i) => `meal_log_items:${i.id}`);
    const savedMeals: SavedMeal[] =
      remember && saveName.trim()
        ? [...state.savedMeals, { id: newId(), name: saveName.trim().slice(0, 60), at: now.toISOString(), items: items.map(({ food, name, quantity, unit, oilLevel }) => ({ food, name, quantity, unit, oilLevel })) }]
        : state.savedMeals;
    dispatch({
      type: 'patch',
      patch: {
        meals: editing ? state.meals.map((m) => (m.id === editing.id ? meal : m)) : [...state.meals, meal],
        savedMeals,
      },
    });
    if (removedItems.length) dispatch({ type: 'tombstone', keys: removedItems });
    router.back();
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="Back" kind="ghost" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/eat'))} />
      </Row>
      <T v="title">{editing ? 'Edit meal' : 'Log a meal'}</T>
      <ChipGroup options={MEAL_ORDER.map((m) => ({ value: m, label: MEAL_LABEL[m] }))} value={mealType} onChange={setMealType} />

      <Card>
        <T v="h2">Snap your plate</T>
        {photoBlocker ? (
          <T v="small">{photoBlocker}</T>
        ) : (
          <>
            <Row>
              <View style={{ flex: 1 }}>
                <Button label={photoBusy ? 'Reading...' : 'Take photo'} onPress={() => fromPhoto('camera')} disabled={photoBusy} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Choose photo" kind="secondary" onPress={() => fromPhoto('library')} disabled={photoBusy} />
              </View>
            </Row>
            <T v="small">The photo goes to the AI only to name the foods and amounts, then it is deleted from the app. You check every item; the app counts the calories.</T>
          </>
        )}
        {askPhotoConsent && (
          <Card tone="sunken">
            <T v="h2">Before your first photo</T>
            <T v="small" style={{ color: color.ink }}>{AI_NOTICE}</T>
            <Row>
              <View style={{ flex: 1 }}>
                <Button label="Agree and continue" onPress={agreePhotos} />
              </View>
              <Button label="Not now" kind="ghost" onPress={() => setAskPhotoConsent(null)} />
            </Row>
          </Card>
        )}
        {photoNote && <Banner tone={photoNote.tone} title={photoNote.title} />}
        {drafts.some((d) => d.from === 'photo') && <T v="small">{getCard('ev-photo-estimates')?.summary ?? ''}</T>}
      </Card>

      <Card>
        <T v="h2">Type what you ate</T>
        <Field label="For example: 2 roti, 1 katori dal, bhindi" value={text} onChangeText={setText} multiline maxLength={500} />
        <Button label="Turn into items" kind="secondary" onPress={parse} disabled={!text.trim()} />
        <T v="small">You check every item before anything is saved. English and Hinglish both work.</T>
      </Card>

      <Card>
        <T v="h2">Or search</T>
        <Field label="Food name" value={query} onChangeText={setQuery} autoCapitalize="none" />
        {results.map((r) => (
          <Pressable key={`${r.kind}:${r.id}`} onPress={() => addFromSearch(r)} accessibilityRole="button" accessibilityLabel={`Add ${r.name}`} style={{ paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: color.sunken }}>
            <T>{r.name}</T>
          </Pressable>
        ))}
        {query.trim().length >= 2 && results.length === 0 && <T v="small">No match. Try another name, for example "chana" or "chole".</T>}
      </Card>

      {drafts.map((d) => {
        const v = valid.find((x) => x.d.key === d.key)!;
        if (!d.food) {
          return (
            <Card key={d.key} tone="warn">
              <T>{`We could not find "${d.text}".`}</T>
              <Row>
                <Button label="Search for it" kind="secondary" onPress={() => (setQuery(d.text), remove(d.key))} />
                <Button label="Remove" kind="ghost" onPress={() => remove(d.key)} />
              </Row>
            </Card>
          );
        }
        const warn = checkLogFood(d.food, prefs);
        const flagged = warn.reasons.map(reasonText).filter(Boolean);
        const units = unitsFor(d.food);
        const measured = isMeasured(d.unit);
        return (
          <Card key={d.key}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T v="h2" style={{ flex: 1 }}>{d.food.name}</T>
              <Button label="Remove" kind="ghost" onPress={() => remove(d.key)} />
            </Row>
            {d.confidence === 'low' && <Banner tone="info" title="Check this one" body={`We read "${d.text}" as ${d.food.name}. Change it if that is wrong.`} />}
            {flagged.length > 0 && <Banner tone="warn" title={`Contains ${flagged.join(', ')}`} body="You listed this as an allergy. You can still log what you ate." />}
            <Eyebrow>Portion</Eyebrow>
            <Row style={{ flexWrap: 'wrap' }}>
              {units.map((u) => (
                <Chip key={u} label={UNIT_LABEL[u][0]} selected={d.unit === u} onPress={() => update(d.key, { unit: u, quantity: isMeasured(u) ? Math.max(10, Math.round((v.totals?.grams?.mid ?? 100) / 10) * 10) : 1 })} />
              ))}
            </Row>
            {d.unit === null ? (
              <T v="small" style={{ color: color.warn }}>Pick a portion unit so we can size it.</T>
            ) : (
              <Stepper
                label="Amount"
                value={d.quantity}
                onChange={(q) => update(d.key, { quantity: q })}
                min={measured ? 5 : 0.25}
                max={measured ? 5000 : 20}
                step={measured ? 5 : 0.25}
                unit={UNIT_LABEL[d.unit][d.quantity === 1 ? 0 : 1]}
              />
            )}
            {hasOilChoice(d.food) && (
              <>
                <Eyebrow>Cooking oil</Eyebrow>
                <ChipGroup options={OIL} value={d.oilLevel ?? 'unsure'} onChange={(o) => update(d.key, { oilLevel: o === 'unsure' ? undefined : o })} />
              </>
            )}
            {numeric && v.totals?.grams && (
              <T v="small">{`${fmtPortion(d.quantity, d.unit!)}: ${fmtTotal('energyKcal', v.totals.nutrients.energyKcal)}, ${fmtTotal('proteinG', v.totals.nutrients.proteinG)}`}</T>
            )}
          </Card>
        );
      })}

      {drafts.length > 0 && (
        <Card tone="sunken">
          {numeric && sum ? (
            <>
              <T v="h2">{problems ? `This meal so far (${ready.length} of ${drafts.length} items)` : 'This meal'}</T>
              <T>{fmtTotal('energyKcal', sum.energyKcal)}</T>
              <T>{fmtTotal('proteinG', sum.proteinG)}</T>
              <T v="small">{`Ranges, because portions and oil vary. ${FOOD_DATA_NOTE}`}</T>
            </>
          ) : (
            <T v="small" style={{ color: color.ink }}>{`${ready.length} ${ready.length === 1 ? 'item' : 'items'} ready to save.`}</T>
          )}
          {problems > 0 && <T v="small" style={{ color: color.warn }}>{`${problems} ${problems === 1 ? 'item needs' : 'items need'} fixing or removing before you save.`}</T>}
          {!editing && (
            <View style={{ gap: space.sm }}>
              <Chip label="Also save as a usual meal" selected={remember} onPress={() => setRemember(!remember)} />
              {remember && <Field label="Name, for example Usual lunch" value={saveName} onChangeText={setSaveName} maxLength={60} />}
            </View>
          )}
          <Button label="Save" onPress={save} disabled={problems > 0 || (remember && !saveName.trim())} />
        </Card>
      )}
    </Screen>
  );
}
