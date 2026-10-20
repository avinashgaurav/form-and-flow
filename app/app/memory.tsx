import { router } from 'expo-router';
import { equipmentList } from '../src/lib/equipment';
import { PLACE_NAME, TONE_NAME, limitText } from '../src/lib/limits';
import { useStore } from '../src/store/store';
import { color } from '../src/theme';
import { Button, Card, Row, Screen, T } from '../src/ui';

const GOAL: Record<string, string> = {
  fat_loss: 'Lose fat', muscle_gain: 'Build muscle', strength: 'Get stronger', fitness: 'Fitness and stamina', mobility: 'Mobility', habits: 'Build the habit', maintenance: 'Maintain',
};
const EXP: Record<string, string> = { none: 'New to training', lt6m: 'Under 6 months', '6to24m': '6 to 24 months', gt2y: '2+ years' };
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** S42 "What my coach knows". Everything the coach uses is listed; nothing is hidden. */
export default function Memory() {
  const { state, dispatch } = useStore();
  const p = state.profile!;
  const facts: [string, string][] = [
    ['Goal', GOAL[p.goal] ?? p.goal],
    ['Experience', EXP[p.training.experience] ?? p.training.experience],
    ['Where you train', PLACE_NAME[p.training.location]],
    ['Equipment', equipmentList(p.training.equipment)],
    ['Days', p.training.daysAvailable.map((d) => DAY[d]).join(', ')],
    ['Session length', `${p.training.sessionMinutes} min`],
    ['Coach style', TONE_NAME[p.tone]],
    ['Limits', state.restrictions.map(limitText).join('; ') || 'none'],
    ['Messages kept', `${state.coachMessages.length} (deleted after 90 days)`],
  ];
  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="Back" kind="ghost" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/coach'))} />
      </Row>
      <T v="title">What my coach knows</T>
      <Card>
        {facts.map(([k, v]) => (
          <Row key={k} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <T v="small">{k}</T>
            <T style={{ flex: 1, textAlign: 'right', color: color.ink }}>{v}</T>
          </Row>
        ))}
      </Card>
      <T v="small">The coach never sees your name, email or year of birth. To change any of this, use Settings.</T>
      <Button label="Open settings" kind="secondary" onPress={() => router.push('/settings')} />
      <Button label="Delete coach conversation" kind="secondary" onPress={() => dispatch({ type: 'patch', patch: { coachMessages: [] } })} />
    </Screen>
  );
}
