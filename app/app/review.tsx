import { weeklyReview, type ProposedChange } from '@ff/engines';
import { router } from 'expo-router';
import { View } from 'react-native';
import { addDays, currentPlan, mondayOf, todayIndex, todayKey, weeksSinceDeload } from '../src/lib/plan';
import { newId, useStore } from '../src/store/store';
import { color, space } from '../src/theme';
import { Banner, Button, Card, Eyebrow, Row, Screen, T } from '../src/ui';

/** S14 weekly review. Measured facts first, estimates labelled, at most two changes, each optional. */
export default function Review() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const today = todayKey(profile.timezone);
  const plan = currentPlan(state)!;
  const dayIdx = todayIndex(state);
  // Only sessions that are already due count: a Monday review must not call Wednesday's session missed.
  const due = plan.week.sessions.filter((s) => s.day < dayIdx || ['completed', 'partial'].includes(state.sessions[s.id]?.status ?? ''));
  const upcoming = plan.week.sessions.length - due.length;
  const weekKeys = new Set(due.map((s) => s.id));
  const logs = Object.values(state.sessions).filter((s) => weekKeys.has(s.key));
  const weekDays = new Set(Array.from({ length: 7 }, (_, i) => addDays(plan.weekStart, i)));
  const energies = Object.values(state.checkIns).filter((c) => weekDays.has(c.day) && c.energy !== undefined).map((c) => c.energy!);
  const declined: Partial<Record<ProposedChange['kind'], string>> = {};
  for (const c of state.planChanges) if (c.decision === 'declined' && (!declined[c.kind] || c.at > declined[c.kind]!)) declined[c.kind] = c.at.slice(0, 10);
  const decidedThisWeek = new Set(state.planChanges.filter((c) => c.weekStart === plan.weekStart).map((c) => c.kind));

  const review = weeklyReview({
    plannedSessions: due.length,
    completedSessions: logs.filter((l) => l.status === 'completed').length,
    partialSessions: logs.filter((l) => l.status === 'partial').length,
    feels: logs.flatMap((l) => (l.feel ? [l.feel] : [])),
    energies,
    setsLogged: state.sets.filter((s) => weekKeys.has(s.sessionKey)).length,
    weeksSinceDeload: weeksSinceDeload(state, today),
    sessionMinutes: profile.training.sessionMinutes,
    volumeBonus: state.planOptions.volumeBonus,
    declined,
    today,
  });
  const open = review.changes.filter((c) => !decidedThisWeek.has(c.kind));

  function decide(change: ProposedChange, decision: 'accepted' | 'declined') {
    const record = { id: newId(), ...change, decision, weekStart: plan.weekStart, at: new Date().toISOString() };
    const patch: Parameters<typeof dispatch>[0] = { type: 'patch', patch: { planChanges: [...state.planChanges, record] } };
    if (decision === 'accepted') {
      if (change.kind === 'deload_next_week') patch.patch.planOptions = { ...state.planOptions, deloadWeekStart: addDays(mondayOf(today), 7) };
      if (change.kind === 'add_volume') patch.patch.planOptions = { ...state.planOptions, volumeBonus: Math.min(2, state.planOptions.volumeBonus + 1) };
      if (change.kind === 'shorten_sessions') {
        patch.patch.profile = { ...profile, training: { ...profile.training, sessionMinutes: Math.max(15, profile.training.sessionMinutes - 10) } };
      }
    }
    dispatch(patch);
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="Back" kind="ghost" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <T v="label">{`Week of ${plan.weekStart}`}</T>
      </Row>
      <T v="title">Weekly review</T>
      {upcoming > 0 && <T v="small">{`So far this week. ${upcoming} session${upcoming === 1 ? ' is' : 's are'} still to come, so they are not counted yet.`}</T>}

      <Card>
        <T v="label">Measured</T>
        {review.facts.map((f) => (
          <Row key={f.label} style={{ justifyContent: 'space-between' }}>
            <T v="small">{f.label}</T>
            <T v="num" style={{ fontSize: 18 }}>{f.value}</T>
          </Row>
        ))}
      </Card>
      {review.estimates.length > 0 && (
        <Card tone="sunken">
          <T v="label">Estimates</T>
          {review.estimates.map((e) => (
            <Row key={e.label} style={{ justifyContent: 'space-between' }}>
              <T v="small">{e.label}</T>
              <T>{e.value}</T>
            </Row>
          ))}
        </Card>
      )}

      {review.insufficient || open.length === 0 ? (
        <Banner tone="info" title={open.length === 0 && !review.insufficient && review.changes.length > 0 ? 'You have decided on this week’s changes.' : review.note} />
      ) : (
        <View style={{ gap: space.lg }}>
          <T v="small">{review.note}</T>
          {open.map((c) => (
            <Card key={c.kind}>
              <Eyebrow>Proposed change</Eyebrow>
              <T v="h2">{c.title}</T>
              <T v="small" style={{ color: color.ink }}>{c.reason}</T>
              <T v="small">{`Rule ${c.ruleIds.join(', ')}`}</T>
              <Row>
                <View style={{ flex: 1 }}>
                  <Button label="Accept" onPress={() => decide(c, 'accepted')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="Not now" kind="secondary" onPress={() => decide(c, 'declined')} />
                </View>
              </Row>
            </Card>
          ))}
        </View>
      )}

      {state.planChanges.length > 0 && (
        <Card tone="sunken">
          <T v="label">Change history</T>
          {[...state.planChanges].reverse().slice(0, 6).map((c) => (
            <T key={c.id} v="small" style={{ color: color.ink }}>{`${c.at.slice(0, 10)}: ${c.title} (${c.decision}, ${c.ruleIds.join(', ')})`}</T>
          ))}
        </Card>
      )}
    </Screen>
  );
}
