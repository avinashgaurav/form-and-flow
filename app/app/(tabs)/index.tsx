import { shortenSession, type PlannedSession } from '@ff/engines';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Icon } from '../../src/icons';
import { mealsOn } from '../../src/lib/food';
import { sentence } from '../../src/lib/limits';
import { currentPlan, daysSinceLastWorkout, effectiveSession, plural, todayIndex, todayKey } from '../../src/lib/plan';
import { useStore } from '../../src/store/store';
import { BORDER, color } from '../../src/theme';
import { Banner, Button, Card, ChipGroup, Eyebrow, Row, Screen, T } from '../../src/ui';

const DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ENERGY = ['Drained', 'Low', 'OK', 'Good', 'Great'].map((label, i) => ({ value: i + 1, label }));

export default function Today() {
  const { state, dispatch } = useStore();
  const profile = state.profile!;
  const plan = currentPlan(state);
  const today = todayKey(profile.timezone);
  const dayIdx = todayIndex(state);
  const checkIn = state.checkIns[today];
  const fresh = plan?.week.sessions.find((s) => s.day === dayIdx);
  const log = fresh ? state.sessions[fresh.id] : undefined;
  const planned = log?.planned ?? fresh;
  const session = planned ? effectiveSession(planned, log) : undefined;
  const nextSession = plan?.week.sessions.find((s) => s.day > dayIdx);
  const gap = daysSinceLastWorkout(state, today);
  const paused = plan?.week.paused || state.restrictions.some((r) => r.code === 'red_flag');
  // A session still to do today: the check-in (energy, time, pain) only helps on those days.
  const trainingToday = !paused && !!session && (!log || log.status === 'planned' || log.status === 'in_progress');

  const dateLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: profile.timezone }).format(new Date());

  function setCheckIn(patch: Partial<NonNullable<typeof checkIn>>) {
    dispatch({ type: 'patch', patch: { checkIns: { ...state.checkIns, [today]: { day: today, ...checkIn, ...patch } } } });
  }

  function applyShorten(s: PlannedSession, minutes: number) {
    const r = shortenSession(s, minutes);
    if (r.kind === 'session') {
      dispatch({ type: 'session', key: s.id, patch: { shortened: { minutes, blocks: r.session.blocks, warmup: r.session.warmup } } });
    }
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <T v="label">{dateLabel}</T>
          <T v="title">Today</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Profile and settings" onPress={() => router.push('/settings')} style={{ width: 48, height: 48, borderRadius: 24, borderWidth: BORDER, borderColor: color.line, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surface }}>
          <Icon name="user" />
        </Pressable>
      </Row>

      {paused ? (
        <Card tone="warn">
          <Eyebrow>Paused</Eyebrow>
          <T v="h2">Training is paused for safety</T>
          <T v="small" style={{ color: color.ink }}>
            {state.restrictions.some((r) => r.code === 'red_flag')
              ? 'You reported a warning symptom. Please get checked by a doctor before the next workout.'
              : 'Your safety answers need a doctor’s clearance first. Logging and learning still work.'}
          </T>
          <Button label="Review safety answers" kind="secondary" onPress={() => router.push('/settings')} />
        </Card>
      ) : trainingToday && session ? (
        <Card>
          <Eyebrow>{log?.status === 'in_progress' ? 'In progress' : 'Next up'}</Eyebrow>
          <T v="h1">{session.title}</T>
          <T v="small">{`About ${session.estimatedMinutes} min · ${plural(session.blocks.length, 'exercise')}${log?.shortened ? ' · shortened' : ''}`}</T>
          {gap !== null && gap >= 7 && <Banner tone="info" title="Welcome back" body="Here is a lighter session to restart. No catching up needed." />}
          <Row style={{ alignItems: 'flex-start' }}>
            <Icon name="info" size={16} stroke={color.muted} />
            <T v="small" style={{ flex: 1 }}>{`${plan!.week.reasons[0] ? `${sentence(plan!.week.reasons[0].text)} ` : ''}Every change shows its reason.`}</T>
          </Row>
          <Button label={log?.status === 'in_progress' ? 'Resume session' : 'Start session'} onPress={() => router.push({ pathname: '/session/[key]', params: { key: session.id } })} tall />
        </Card>
      ) : (
        <Card tone={log?.status === 'completed' ? 'ok' : 'surface'}>
          <Eyebrow>{log?.status === 'completed' ? 'Done' : 'Rest day'}</Eyebrow>
          <T v="h2">{log?.status === 'completed' ? 'Session done. Nice work.' : 'Rest is part of the plan'}</T>
          <T v="small" style={{ color: color.ink }}>{nextSession ? `Next: ${nextSession.title} on ${DAY[nextSession.day]}.` : 'Your next week is built on Monday.'}</T>
        </Card>
      )}

      {trainingToday && (
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="h2">How is today?</T>
          <T v="small">3 taps</T>
        </Row>
        <T v="label">Energy</T>
        <ChipGroup options={ENERGY} value={checkIn?.energy} onChange={(energy) => setCheckIn({ energy })} />
        <T v="label">Time today</T>
        <ChipGroup options={[10, 15, 20, 30, 45, 60].map((n) => ({ value: n, label: `${n} min` }))} value={checkIn?.minutes} onChange={(minutes) => setCheckIn({ minutes })} />
        <T v="label">Any pain?</T>
        <ChipGroup
          options={[{ value: 'no', label: 'No pain' }, { value: 'yes', label: 'Something hurts' }]}
          value={checkIn?.pain === undefined ? undefined : checkIn.pain ? 'yes' : 'no'}
          onChange={(v) => {
            setCheckIn({ pain: v === 'yes' });
            if (v === 'yes') router.push('/pain');
          }}
        />
        {checkIn?.energy !== undefined && checkIn.energy <= 2 && !paused && session && (
          <Banner tone="info" title="Low energy is fine" body="A shorter session or a rest day both count. Use the time chips to shorten today." />
        )}
        {session && !paused && checkIn?.minutes !== undefined && checkIn.minutes < session.estimatedMinutes && log?.shortened?.minutes !== checkIn.minutes && (
          <Button label={`Shorten today to ${checkIn.minutes} min`} kind="secondary" icon="timer" onPress={() => planned && applyShorten(planned, checkIn.minutes!)} />
        )}
      </Card>
      )}

      {/* On days without the check-in, pain still has a way in. */}
      {!trainingToday && <Button label="Something hurts" kind="ghost" icon="alert" onPress={() => router.push('/pain')} />}

      {dayIdx >= 5 && !paused && (
        <Card>
          <Eyebrow>Weekly review</Eyebrow>
          <T v="h2">How did this week go?</T>
          <T v="small">Two minutes: what happened, and at most two optional changes for next week.</T>
          <Button label="Open review" kind="secondary" onPress={() => router.push('/review')} />
        </Card>
      )}

      <Card tone="sunken">
        <T v="h2">Food</T>
        <T v="small" style={{ color: color.ink }}>
          {(() => {
            const n = mealsOn(state, today).length;
            return n ? `${n} ${n === 1 ? 'meal' : 'meals'} logged today.` : 'Nothing logged yet today. Logging some meals is enough.';
          })()}
        </T>
        <Button label="Log a meal" kind={trainingToday ? 'secondary' : 'primary'} onPress={() => router.push('/meal')} />
      </Card>
    </Screen>
  );
}
