import { router } from 'expo-router';
import { View } from 'react-native';
import { currentPlan, exerciseName } from '../../src/lib/plan';
import { useStore } from '../../src/store/store';
import { color, space } from '../../src/theme';
import { Bar, Button, Card, EmptyState, Row, Screen, T } from '../../src/ui';

export default function Progress() {
  const { state } = useStore();
  const plan = currentPlan(state);
  const planned = plan?.week.sessions.length ?? 0;
  const doneThisWeek = plan?.week.sessions.filter((s) => state.sessions[s.id]?.status === 'completed').length ?? 0;

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

  return (
    <Screen>
      <T v="title">Progress</T>
      <Card>
        <T v="h2">Consistency this week</T>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="small">Sessions done</T>
          <T v="num">{`${doneThisWeek} of ${planned}`}</T>
        </Row>
        <View accessibilityLabel={`${doneThisWeek} of ${planned} sessions done this week`}>
          <Bar value={planned ? doneThisWeek / planned : 0} />
        </View>
        <T v="small">Rest days count as part of the plan, not as misses.</T>
        <Button label="Weekly review" kind="secondary" onPress={() => router.push('/review')} />
      </Card>

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
