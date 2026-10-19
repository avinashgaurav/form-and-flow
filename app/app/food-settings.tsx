import { inRange, matchFreeTextAllergies, RANGES, type AllergenTag, type Diet, type Sex } from '@ff/engines';
import { router } from 'expo-router';
import { useState } from 'react';
import { useStore } from '../src/store/store';
import type { Profile } from '../src/store/types';
import { color } from '../src/theme';
import { Banner, Button, Card, Chip, ChipGroup, Field, Row, Screen, T } from '../src/ui';

const ALLERGENS: { value: AllergenTag; label: string }[] = [
  { value: 'milk', label: 'Milk' }, { value: 'gluten', label: 'Gluten' }, { value: 'peanut', label: 'Peanut' }, { value: 'tree_nut', label: 'Tree nuts' },
  { value: 'soy', label: 'Soy' }, { value: 'egg', label: 'Egg' }, { value: 'fish', label: 'Fish' }, { value: 'shellfish', label: 'Shellfish' },
  { value: 'sesame', label: 'Sesame' }, { value: 'mustard', label: 'Mustard' },
];

/** Food preferences (plan/10): numbers or plate guidance, body measurements, diet and allergies. */
export default function FoodSettings() {
  const { state, dispatch } = useStore();
  const n = state.nutrition;
  const forced = state.restrictions.some((r) => r.code === 'non_numeric_only');
  const [height, setHeight] = useState(state.profile?.heightCm ? String(state.profile.heightCm) : '');
  const [weight, setWeight] = useState(state.profile?.weightKg ? String(state.profile.weightKg) : '');
  const [free, setFree] = useState(n.freeTextAllergies.join(', '));
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState<AllergenTag | null>(null);

  const setN = (patch: Partial<typeof n>) => dispatch({ type: 'patch', patch: { nutrition: { ...n, ...patch } } });
  const freeList = free.split(',').map((x) => x.trim()).filter(Boolean);
  const match = matchFreeTextAllergies(freeList);
  const hErr = height && !inRange(Number(height), RANGES.heightCm) ? 'Height should be between 120 and 220 cm.' : undefined;
  const wErr = weight && !inRange(Number(weight), RANGES.weightKg) ? 'Weight should be between 30 and 250 kg.' : undefined;

  function saveBody() {
    if (hErr || wErr || !state.profile) return;
    const profile: Profile = { ...state.profile, heightCm: height ? Number(height) : undefined, weightKg: weight ? Number(weight) : undefined };
    dispatch({ type: 'patch', patch: { profile } });
    setSaved(true);
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="Back" kind="ghost" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/eat'))} />
      </Row>
      <T v="title">Food settings</T>

      <Card>
        <T v="h2">Numbers or plate guidance</T>
        {forced ? (
          <T v="small">Plate guidance is on because of your safety answers. No calorie numbers are shown anywhere in the app.</T>
        ) : (
          <>
            <ChipGroup
              options={[{ value: 'numeric', label: 'Show numbers' }, { value: 'non_numeric', label: 'Plate guidance only' }]}
              value={n.mode}
              onChange={(mode) => setN({ mode })}
            />
            <T v="small">Plate guidance hides every calorie number in the app.</T>
          </>
        )}
      </Card>

      <Card>
        <T v="h2">For the energy estimate</T>
        <T v="small">Used only to estimate how much energy you use. Nothing else changes.</T>
        <ChipGroup<Sex>
          options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'prefer_not_to_say', label: 'Prefer not to say' }]}
          value={n.sex ?? 'prefer_not_to_say'}
          onChange={(sex) => setN({ sex })}
        />
        <Field label="Height (cm)" value={height} onChangeText={setHeight} keyboardType="numeric" error={hErr} />
        <Field label="Weight (kg), optional" value={weight} onChangeText={setWeight} keyboardType="numeric" error={wErr} hint="Without it there is no energy or protein number; we do not guess." />
        <ChipGroup<NonNullable<Profile['activity']>>
          options={[{ value: 'low', label: 'Mostly sitting' }, { value: 'light', label: 'Light' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'Very active' }]}
          value={state.profile?.activity ?? 'light'}
          onChange={(activity) => state.profile && dispatch({ type: 'patch', patch: { profile: { ...state.profile, activity } } })}
        />
      </Card>

      <Card>
        <T v="h2">Diet</T>
        <ChipGroup<Diet>
          options={[{ value: 'vegan', label: 'Vegan' }, { value: 'veg', label: 'Vegetarian' }, { value: 'egg', label: 'Eggetarian' }, { value: 'non_veg', label: 'Non-veg' }]}
          value={n.diet}
          onChange={(diet) => setN({ diet })}
        />
        <Chip label="Jain" selected={!!n.jain} onPress={() => setN({ jain: !n.jain })} />
      </Card>

      <Card>
        <T v="h2">Allergies</T>
        <T v="small">We flag these foods when you log them and keep them out of suggestions. Always check labels yourself.</T>
        <ChipGroup<AllergenTag>
          multi
          options={ALLERGENS}
          value={n.allergens}
          // Adding an allergy is instant; removing one asks first (plan/15: allergies are hard filters).
          onChange={(tag) => (n.allergens.includes(tag) ? setRemoving(tag) : setN({ allergens: [...n.allergens, tag] }))}
        />
        {removing && (
          <Banner tone="warn" title={`Remove ${ALLERGENS.find((a) => a.value === removing)?.label.toLowerCase()} from your allergies?`} body="We will stop warning you about it." />
        )}
        {removing && (
          <Row>
            <Button label="Yes, remove" kind="secondary" onPress={() => (setN({ allergens: n.allergens.filter((x) => x !== removing) }), setRemoving(null))} />
            <Button label="Keep it" kind="ghost" onPress={() => setRemoving(null)} />
          </Row>
        )}
        <Field
          label="Anything else, separated by commas"
          value={free}
          onChangeText={(t) => {
            setFree(t);
            // Saved as you type, so an allergy is never lost by leaving the screen.
            setN({ freeTextAllergies: t.split(',').map((x) => x.trim()).filter(Boolean) });
          }}
          placeholder="kaju, dairy"
        />
        {freeList.length > 0 && match.unrecognised.length > 0 && (
          <Banner tone="warn" title={`Not recognised: ${match.unrecognised.join(', ')}`} body="We cannot flag these. Please check food labels yourself." />
        )}
      </Card>

      <Button label="Save height and weight" onPress={saveBody} disabled={!!hErr || !!wErr} />
      {saved && <T v="small" style={{ color: color.ok }}>Saved.</T>}
    </Screen>
  );
}
