import { assessPain, type PainAction, type Region } from '@ff/engines';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { todayKey } from '../src/lib/plan';
import { newId, useStore } from '../src/store/store';
import { color, space } from '../src/theme';
import { Banner, Button, Card, Chip, ChipGroup, Row, Screen, T } from '../src/ui';

const REGIONS: { value: Region; label: string }[] = [
  { value: 'knee', label: 'Knee' }, { value: 'lower_back', label: 'Lower back' }, { value: 'shoulder', label: 'Shoulder' }, { value: 'wrist', label: 'Wrist' },
  { value: 'hip', label: 'Hip' }, { value: 'ankle', label: 'Ankle' }, { value: 'elbow', label: 'Elbow' }, { value: 'neck', label: 'Neck' },
];

/** S37 pain report. The body map is a labelled list so it works with a screen reader (plan/07). */
export default function Pain() {
  const { session } = useLocalSearchParams<{ session?: string }>();
  const { state, dispatch } = useStore();
  const [region, setRegion] = useState<Region>();
  const [rating, setRating] = useState<number>();
  const [sharp, setSharp] = useState(false);
  const [swelling, setSwelling] = useState(false);
  const [numbness, setNumbness] = useState(false);
  const [redFlag, setRedFlag] = useState<boolean>();
  const [result, setResult] = useState<PainAction>();

  const ready = redFlag === true || (region !== undefined && rating !== undefined && redFlag === false);

  function submit() {
    const today = todayKey(state.profile!.timezone);
    const r = redFlag ? assessPain({ region: region ?? 'knee', rating: rating ?? 0, redFlag: true }, today) : assessPain({ region: region!, rating: rating!, sharp, swelling, numbness }, today);
    dispatch({ type: 'safety', event: { id: newId(), type: r.action === 'emergency' ? 'red_flag_symptom' : 'pain_report', at: new Date().toISOString(), detail: `${region ?? '-'} ${rating ?? '-'}/10 ${r.action}` } });
    if (r.action === 'emergency') {
      dispatch({ type: 'restriction:add', restriction: { code: 'red_flag', source: 'user' } });
      if (session) dispatch({ type: 'session', key: session, patch: { status: 'partial', endedAt: new Date().toISOString() } });
      router.replace({ pathname: '/safety', params: { kind: 'red_flag' } });
      return;
    }
    if (r.action === 'end_session' || r.action === 'stop_exercise') dispatch({ type: 'restriction:add', restriction: r.restriction });
    if (r.action === 'end_session' && session) dispatch({ type: 'session', key: session, patch: { status: 'partial', endedAt: new Date().toISOString() } });
    setResult(r);
  }

  if (result && result.action !== 'emergency') {
    return (
      <Screen>
        <T v="title">{result.action === 'end_session' ? 'End the session here' : result.action === 'stop_exercise' ? 'Stop that exercise' : 'Go lighter'}</T>
        <Card tone={result.action === 'continue_lighter' ? 'sunken' : 'warn'}>
          <T>{result.advice}</T>
        </Card>
        {result.action !== 'continue_lighter' && <T v="small">Exercises that load this area are left out of your plan for 7 days.</T>}
        <Button label={session && result.action !== 'end_session' ? 'Back to the session' : 'Back to Today'} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} tall />
      </Screen>
    );
  }

  return (
    <Screen>
      <T v="title">What hurts?</T>
      <Card tone="danger">
        <T v="h2">First: any of these right now?</T>
        <T v="small" style={{ color: color.ink }}>Chest pain or pressure, fainting, severe breathlessness, or sudden weakness or numbness on one side.</T>
        <ChipGroup options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} value={redFlag === undefined ? undefined : redFlag ? 'yes' : 'no'} onChange={(v) => setRedFlag(v === 'yes')} />
      </Card>
      {redFlag === false && (
        <View style={{ gap: space.lg }}>
          <T v="label">Where</T>
          <ChipGroup options={REGIONS} value={region} onChange={setRegion} />
          <T v="label">How bad, 0 to 10</T>
          <ChipGroup options={Array.from({ length: 11 }, (_, i) => ({ value: i, label: String(i) }))} value={rating} onChange={setRating} />
          <T v="label">Any of these?</T>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label="Sharp or stabbing" selected={sharp} onPress={() => setSharp(!sharp)} />
            <Chip label="Swelling" selected={swelling} onPress={() => setSwelling(!swelling)} />
            <Chip label="Numbness or tingling" selected={numbness} onPress={() => setNumbness(!numbness)} />
          </Row>
        </View>
      )}
      {redFlag === true && <Banner tone="danger" title="Stop now" body="Tap continue for emergency numbers." />}
      <Button label="Continue" kind={redFlag ? 'danger' : 'primary'} onPress={submit} disabled={!ready} tall />
      <Button label="Cancel" kind="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <T v="small">This is not a diagnosis. We only decide what to leave out of your plan.</T>
    </Screen>
  );
}
