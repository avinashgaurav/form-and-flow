import { getExercise, substitutes, shortenSession, type Block } from '@ff/engines';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Icon } from '../../src/icons';
import { ExerciseVideo } from '../../src/media/ExerciseVideo';
import { effectiveSession, exerciseName, plannedFor, plural, setsFor, suggestion } from '../../src/lib/plan';
import { newId, useStore } from '../../src/store/store';
import { color, space } from '../../src/theme';
import { Banner, Button, Card, Chip, ChipGroup, EmptyState, Eyebrow, Row, Screen, Stepper, T } from '../../src/ui';

/** The target in plain words: "3 sets of 8 to 12 reps · rest 90 s · stop with 2 reps to spare". */
const spare = (b: Block) => (b.unit === 'seconds' ? 'stop before your form slips' : `stop with ${b.targetRir} ${b.targetRir === 1 ? 'rep' : 'reps'} to spare`);
const target = (b: Block) => `${b.sets} sets of ${b.repMin} to ${b.repMax} ${b.unit === 'seconds' ? 'seconds' : 'reps'} · rest ${b.restSec} s · ${spare(b)}`;

/** How a set felt, stored as reps left in the tank (the progression rules read that number). */
const FEEL = [
  { value: 4, label: 'Easy' },
  { value: 2, label: 'Just right' },
  { value: 0, label: 'Hard' },
];
const SESSION_FEEL = { too_easy: 'too easy', right: 'about right', too_hard: 'too hard' } as const;
const feltWord = (rir: number) => (rir >= 3 ? 'easy' : rir >= 1 ? 'just right' : 'hard');

export default function SessionScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const { state, dispatch } = useStore();
  const planned = key ? plannedFor(state, key) : undefined;
  const log = key ? state.sessions[key] : undefined;

  if (!planned || !key) {
    return (
      <Screen>
        <EmptyState title="Session not found" body="This session belongs to an older week. Your logged sets are still saved." action={<Button label="Back to Today" onPress={() => router.replace('/')} />} />
      </Screen>
    );
  }

  const session = effectiveSession(planned, log);
  const status = log?.status;
  const header = (
    <>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="Back" kind="ghost" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <T v="label">{status === 'in_progress' ? 'In progress' : status === 'completed' ? 'Completed' : status === 'partial' ? 'Ended early' : 'Overview'}</T>
      </Row>
      <T v="h1">{session.title}</T>
    </>
  );

  if (status === 'in_progress') return <Player sessionKey={key} header={header} />;
  if (status === 'completed' || status === 'partial') {
    return (
      <Screen>
        {header}
        <Summary sessionKey={key} />
      </Screen>
    );
  }
  return <Overview sessionKey={key} header={header} />;
}

function useSession(key: string) {
  const { state } = useStore();
  const planned = plannedFor(state, key)!;
  const log = state.sessions[key];
  return { planned, log, session: effectiveSession(planned, log) };
}

function Overview({ sessionKey, header }: { sessionKey: string; header: ReactNode }) {
  const { state, dispatch } = useStore();
  const { planned, log, session } = useSession(sessionKey);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const profile = state.profile!;

  const start = () => dispatch({ type: 'session', key: sessionKey, patch: { status: 'in_progress', startedAt: new Date().toISOString(), swaps: log?.swaps ?? {}, planned } });
  return (
    <Screen footer={<Button label={`Start session · about ${session.estimatedMinutes} min`} tall onPress={start} />}>
      {header}
      <T v="small">{`About ${session.estimatedMinutes} min${log?.shortened ? ` (shortened to ${log.shortened.minutes})` : ''}`}</T>
      <Card tone="sunken">
        <T v="label">Warm-up</T>
        <T>{session.warmup.map(exerciseName).join(', ')}</T>
      </Card>
      {session.blocks.map((b, i) => {
        const original = (log?.shortened?.blocks ?? planned.blocks)[i]?.exerciseId ?? b.exerciseId;
        const subs = swapFor === b.exerciseId ? substitutes(b.exerciseId, { equipment: profile.training.equipment, restrictions: state.restrictions, experience: profile.training.experience }) : [];
        return (
          <Card key={b.exerciseId + i}>
            <T v="h2">{exerciseName(b.exerciseId)}</T>
            <T v="small">{target(b)}</T>
            <Button label="Swap exercise" kind="secondary" icon="swap" onPress={() => setSwapFor(swapFor === b.exerciseId ? null : b.exerciseId)} />
            {swapFor === b.exerciseId && (
              <View style={{ gap: space.sm }}>
                {subs.length === 0 ? (
                  <T v="small">No safe alternative fits your equipment and limits. You can skip it during the session.</T>
                ) : (
                  subs.map((e) => (
                    <Button
                      key={e.id}
                      label={e.name}
                      kind="secondary"
                      onPress={() => {
                        dispatch({ type: 'session', key: sessionKey, patch: { swaps: { ...(log?.swaps ?? {}), [original]: e.id } } });
                        setSwapFor(null);
                      }}
                    />
                  ))
                )}
              </View>
            )}
          </Card>
        );
      })}
      <Card>
        <T v="label">Short on time?</T>
        <ChipGroup
          options={[10, 15, 20, 30].map((n) => ({ value: n, label: `${n} min` }))}
          value={log?.shortened?.minutes}
          onChange={(minutes) => {
            const r = shortenSession(planned, minutes);
            if (r.kind === 'session') dispatch({ type: 'session', key: sessionKey, patch: { shortened: { minutes, blocks: r.session.blocks, warmup: r.session.warmup } } });
          }}
        />
        <T v="small">Shortening keeps the warm-up and the main lift and never makes it harder.</T>
      </Card>
    </Screen>
  );
}

function Player({ sessionKey, header }: { sessionKey: string; header: ReactNode }) {
  const { state } = useStore();
  const { planned, log, session } = useSession(sessionKey);
  const blocks = session.blocks;
  const doneCounts = blocks.map((b) => setsFor(state.sets, sessionKey, b.exerciseId).length);
  const [skipped, setSkipped] = useState<string[]>([]);
  const idx = blocks.findIndex((b, i) => doneCounts[i]! < b.sets && !skipped.includes(b.exerciseId));
  const block = idx >= 0 ? blocks[idx] : undefined;

  if (!block) {
    return (
      <Screen>
        {header}
        <Finish sessionKey={sessionKey} />
      </Screen>
    );
  }
  const originalId = (log?.shortened?.blocks ?? planned.blocks)[idx]?.exerciseId ?? block.exerciseId;
  return <BlockView key={block.exerciseId} header={header} sessionKey={sessionKey} block={block} originalId={originalId} position={`${idx + 1} of ${blocks.length}`} onSkip={() => setSkipped([...skipped, block.exerciseId])} />;
}

function BlockView({ header, sessionKey, block, originalId, position, onSkip }: { header: ReactNode; sessionKey: string; block: Block; originalId: string; position: string; onSkip: () => void }) {
  const { state, dispatch, logSet, removeSet } = useStore();
  const ex = getExercise(block.exerciseId);
  const done = setsFor(state.sets, sessionKey, block.exerciseId);
  const sug = useMemo(() => suggestion(state.sets, block, sessionKey), [state.sets, block, sessionKey]);
  const last = done.at(-1);
  const [reps, setReps] = useState(last?.reps ?? block.repMax);
  const [load, setLoad] = useState(last?.loadKg ?? (sug.action === 'increase_load' || sug.action === 'decrease_load' ? sug.loadKg : sug.lastLoad));
  const [rir, setRir] = useState<number | undefined>(undefined);
  const [pendingId, setPendingId] = useState(newId);
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  // Cues are open for the first set and fold away once the move is under way.
  const [showCues, setShowCues] = useState(done.length === 0);
  const [showMore, setShowMore] = useState(false);
  const [showSwap, setShowSwap] = useState(false);
  const profile = state.profile!;
  const subs = showSwap ? substitutes(block.exerciseId, { equipment: profile.training.equipment, restrictions: state.restrictions, experience: profile.training.experience }) : [];
  const unitWord = block.unit === 'seconds' ? 'Seconds' : 'Reps';

  useEffect(() => {
    if (done.length === 1) setShowCues(false);
  }, [done.length]);

  useEffect(() => {
    if (!restUntil) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [restUntil]);
  const restLeft = restUntil ? Math.max(0, Math.ceil((restUntil - now) / 1000)) : 0;

  async function doneSet() {
    await logSet({ id: pendingId, sessionKey, exerciseId: block.exerciseId, setIndex: done.length + 1, reps, loadKg: ex?.loaded ? load : 0, rir });
    setPendingId(newId());
    setRir(undefined);
    if (done.length + 1 < block.sets) setRestUntil(Date.now() + block.restSec * 1000);
  }

  const sugText = !ex?.loaded
    ? sug.action === 'suggest_harder' ? 'You hit the top of the range last time. Try the harder version when you are ready.' : 'Bodyweight: aim for the top of the rep range with good form.'
    : sug.action === 'increase_load' ? `Suggested ${sug.loadKg} kg. ${sug.reason}`
    : sug.action === 'decrease_load' ? `Suggested ${sug.loadKg} kg. ${sug.reason}`
    : sug.lastLoad > 0 ? `Last time ${sug.lastLoad} kg. ${sug.reason}`
    : 'First time: pick a weight you could lift 2 to 3 more times at the end of each set.';

  // The pinned bar: during rest, the timer; otherwise this set's numbers and Done set.
  // Each state has its own key, so switching between them remounts rather than patching styles.
  const footer = restLeft > 0 ? (
    <Row key="rest" style={{ justifyContent: 'space-between' }}>
      <View>
        <T v="label">Rest</T>
        <T v="num" style={{ fontSize: 32, lineHeight: 36 }} accessibilityRole="text">{`${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, '0')}`}</T>
      </View>
      <Button label="Skip rest" kind="secondary" onPress={() => setRestUntil(null)} />
    </Row>
  ) : (
    <View key="set" style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: space.xs }}>
        <T v="label">{`Set ${done.length + 1} of ${block.sets}`}</T>
        <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
          {FEEL.map((f) => (
            <Chip key={f.value} label={f.label} selected={rir === f.value} onPress={() => setRir(rir === f.value ? undefined : f.value)} accessibilityLabel={`This set felt ${f.label.toLowerCase()} (optional)`} />
          ))}
        </Row>
      </Row>
      <Row style={{ alignItems: 'flex-end', flexWrap: 'wrap', rowGap: space.sm }}>
        <View style={{ gap: 2 }}>
          <T v="small">{unitWord}</T>
          <Stepper label={unitWord} value={reps} min={0} max={block.unit === 'seconds' ? 300 : 100} step={block.unit === 'seconds' ? 5 : 1} onChange={setReps} />
        </View>
        {ex?.loaded && (
          <View style={{ gap: 2 }}>
            <T v="small">Weight</T>
            <Stepper label="Weight in kilograms" unit="kg" value={load} min={0} max={500} step={ex.allOf.includes('barbell') ? 2.5 : 0.5} onChange={setLoad} />
          </View>
        )}
        {!ex?.loaded && (
          <View style={{ flex: 1, minWidth: 140 }}>
            <Button label="Done set" icon="check" tall onPress={doneSet} />
          </View>
        )}
      </Row>
      {ex?.loaded && <Button label="Done set" icon="check" tall onPress={doneSet} />}
    </View>
  );

  return (
    <Screen footer={footer}>
      {header}
      <T v="label">{`Exercise ${position}`}</T>
      <Card>
        <ExerciseVideo key={block.exerciseId} exerciseId={block.exerciseId} name={ex?.name ?? block.exerciseId} />
        <T v="h1">{ex?.name ?? block.exerciseId}</T>
        <T v="small">{target(block)}</T>
        {ex?.reviewStatus === 'draft' && <Eyebrow>Draft cues, not yet reviewed</Eyebrow>}
        <Button label={showCues ? 'Hide how to do it' : 'Show how to do it'} kind="ghost" onPress={() => setShowCues(!showCues)} />
        {showCues && ex && (
          <View style={{ gap: 4 }}>
            {ex.cues.map((c) => <T key={c} v="small" style={{ color: color.ink }}>{`• ${c}`}</T>)}
            {ex.mistakes.map((m) => <T key={m} v="small">{`Avoid: ${m}`}</T>)}
          </View>
        )}
      </Card>

      <Banner tone="info" title={sugText} />

      {done.length > 0 && (
        <View style={{ gap: space.sm }} accessibilityLabel="Logged sets">
          {done.map((s) => (
            <Row key={s.id} style={{ backgroundColor: color.okWash, borderRadius: 8, padding: space.sm, justifyContent: 'space-between' }}>
              <Row>
                <Icon name="check" size={18} stroke={color.ok} width={2.6} />
                <T>{`Set ${s.setIndex}: ${s.reps}${block.unit === 'seconds' ? ' s' : ''}${ex?.loaded ? ` × ${s.loadKg} kg` : ''}${s.rir !== undefined ? ` · felt ${feltWord(s.rir)}` : ''}`}</T>
              </Row>
              <Row gap={4}>
                <Icon name="saved" size={16} stroke={color.ok} />
                <T v="small" style={{ color: color.ok }}>Saved</T>
              </Row>
            </Row>
          ))}
          <Button label="Undo last set" kind="ghost" onPress={() => removeSet(done.at(-1)!.id)} />
        </View>
      )}

      <Button label="Something hurts" kind="ghost" icon="alert" onPress={() => router.push({ pathname: '/pain', params: { session: sessionKey } })} />
      <Button label={showMore ? 'Fewer options' : 'More options'} kind="ghost" onPress={() => setShowMore(!showMore)} />
      {showMore && (
        <Card tone="sunken">
          <Button label="Swap this exercise" kind="secondary" icon="swap" onPress={() => setShowSwap(!showSwap)} />
          {showSwap && (
            <View style={{ gap: space.sm }}>
              <T v="label">Alternatives that fit your equipment and limits</T>
              {subs.length === 0 ? (
                <T v="small">No safe alternative fits. You can skip this exercise instead.</T>
              ) : (
                subs.map((e) => (
                  <Button key={e.id} label={e.name} kind="secondary" onPress={() => dispatch({ type: 'session', key: sessionKey, patch: { swaps: { ...(state.sessions[sessionKey]?.swaps ?? {}), [originalId]: e.id } } })} />
                ))
              )}
            </View>
          )}
          <Button label="Skip this exercise" kind="secondary" onPress={onSkip} />
          <Button label="End session early" kind="secondary" onPress={() => dispatch({ type: 'session', key: sessionKey, patch: { status: 'partial', endedAt: new Date().toISOString() } })} />
        </Card>
      )}
    </Screen>
  );
}

function Finish({ sessionKey }: { sessionKey: string }) {
  const { state, dispatch } = useStore();
  const log = state.sessions[sessionKey];
  const count = state.sets.filter((s) => s.sessionKey === sessionKey).length;
  return (
    <View style={{ gap: space.lg }}>
      <Card tone="ok">
        <Eyebrow>All sets logged</Eyebrow>
        <T v="h2">{`${plural(count, 'set')} saved`}</T>
        <T v="small" style={{ color: color.ink }}>How did that feel? This tunes next time.</T>
        <ChipGroup
          options={[{ value: 'too_easy', label: 'Too easy' }, { value: 'right', label: 'About right' }, { value: 'too_hard', label: 'Too hard' }]}
          value={log?.feel}
          onChange={(feel) => dispatch({ type: 'session', key: sessionKey, patch: { feel } })}
        />
      </Card>
      <Button label="Finish session" tall onPress={() => dispatch({ type: 'session', key: sessionKey, patch: { status: 'completed', endedAt: new Date().toISOString() } })} />
    </View>
  );
}

function Summary({ sessionKey }: { sessionKey: string }) {
  const { state } = useStore();
  const log = state.sessions[sessionKey]!;
  const sets = state.sets.filter((s) => s.sessionKey === sessionKey);
  const byEx = [...new Set(sets.map((s) => s.exerciseId))];
  return (
    <View style={{ gap: space.lg }}>
      <Card tone={log.status === 'completed' ? 'ok' : 'warn'}>
        <T v="h2">{log.status === 'completed' ? 'Session complete' : 'Ended early, and that is fine'}</T>
        <T v="small" style={{ color: color.ink }}>{`${plural(sets.length, 'set')} across ${plural(byEx.length, 'exercise')}${log.feel ? ` · felt ${SESSION_FEEL[log.feel]}` : ''}`}</T>
      </Card>
      {byEx.map((id) => (
        <Card key={id}>
          <T v="h2">{exerciseName(id)}</T>
          <T v="small">{sets.filter((s) => s.exerciseId === id).map((s) => `${s.reps}${s.loadKg ? ` × ${s.loadKg} kg` : ''}`).join(' · ')}</T>
        </Card>
      ))}
      <T v="small">No calories-burned estimate is shown: it would be a guess presented as a measurement.</T>
      <Button label="Back to Today" onPress={() => router.replace('/')} />
    </View>
  );
}
