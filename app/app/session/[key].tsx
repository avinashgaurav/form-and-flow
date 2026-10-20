import { getExercise, substitutes, shortenSession, type Block } from '@ff/engines';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '../../src/icons';
import { ExerciseVideo } from '../../src/media/ExerciseVideo';
import { effectiveSession, exerciseName, plannedFor, plural, setsFor, suggestion } from '../../src/lib/plan';
import { newId, useStore } from '../../src/store/store';
import { color, space } from '../../src/theme';
import { Banner, Button, Card, ChipGroup, EmptyState, Eyebrow, Row, Screen, Stepper, T } from '../../src/ui';

const target = (b: Block) => `${b.sets} × ${b.repMin} to ${b.repMax} ${b.unit === 'seconds' ? 'sec' : 'reps'} · rest ${b.restSec}s · ${b.targetRir}+ in reserve`;

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

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="Back" kind="ghost" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <T v="label">{status === 'in_progress' ? 'In progress' : status === 'completed' ? 'Completed' : status === 'partial' ? 'Ended early' : 'Overview'}</T>
      </Row>
      <T v="h1">{session.title}</T>
      {status === 'in_progress' ? (
        <Player sessionKey={key} />
      ) : status === 'completed' || status === 'partial' ? (
        <Summary sessionKey={key} />
      ) : (
        <Overview sessionKey={key} />
      )}
    </Screen>
  );
}

function useSession(key: string) {
  const { state } = useStore();
  const planned = plannedFor(state, key)!;
  const log = state.sessions[key];
  return { planned, log, session: effectiveSession(planned, log) };
}

function Overview({ sessionKey }: { sessionKey: string }) {
  const { state, dispatch } = useStore();
  const { planned, log, session } = useSession(sessionKey);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const profile = state.profile!;

  return (
    <View style={{ gap: space.lg }}>
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
      <Button label="Start session" tall onPress={() => dispatch({ type: 'session', key: sessionKey, patch: { status: 'in_progress', startedAt: new Date().toISOString(), swaps: log?.swaps ?? {}, planned } })} />
    </View>
  );
}

function Player({ sessionKey }: { sessionKey: string }) {
  const { state } = useStore();
  const { planned, log, session } = useSession(sessionKey);
  const blocks = session.blocks;
  const doneCounts = blocks.map((b) => setsFor(state.sets, sessionKey, b.exerciseId).length);
  const [skipped, setSkipped] = useState<string[]>([]);
  const idx = blocks.findIndex((b, i) => doneCounts[i]! < b.sets && !skipped.includes(b.exerciseId));
  const block = idx >= 0 ? blocks[idx] : undefined;

  if (!block) return <Finish sessionKey={sessionKey} />;
  const originalId = (log?.shortened?.blocks ?? planned.blocks)[idx]?.exerciseId ?? block.exerciseId;
  return <BlockView key={block.exerciseId} sessionKey={sessionKey} block={block} originalId={originalId} position={`${idx + 1} of ${blocks.length}`} onSkip={() => setSkipped([...skipped, block.exerciseId])} />;
}

function BlockView({ sessionKey, block, originalId, position, onSkip }: { sessionKey: string; block: Block; originalId: string; position: string; onSkip: () => void }) {
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
  const [showCues, setShowCues] = useState(true);
  const [showSwap, setShowSwap] = useState(false);
  const profile = state.profile!;
  const subs = showSwap ? substitutes(block.exerciseId, { equipment: profile.training.equipment, restrictions: state.restrictions, experience: profile.training.experience }) : [];

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

  return (
    <View style={{ gap: space.lg }}>
      <T v="label">{`Exercise ${position}`}</T>
      <Card>
        <ExerciseVideo key={block.exerciseId} exerciseId={block.exerciseId} name={ex?.name ?? block.exerciseId} />
        <T v="h1">{ex?.name ?? block.exerciseId}</T>
        <T v="small">{`Target ${target(block)}`}</T>
        {ex?.reviewStatus === 'draft' && <Eyebrow>Draft cues, not yet reviewed</Eyebrow>}
        <Button label={showCues ? 'Hide cues' : 'Show cues'} kind="ghost" onPress={() => setShowCues(!showCues)} />
        {showCues && ex && (
          <View style={{ gap: 4 }}>
            {ex.cues.map((c) => <T key={c} v="small" style={{ color: color.ink }}>{`• ${c}`}</T>)}
            {ex.mistakes.map((m) => <T key={m} v="small">{`Avoid: ${m}`}</T>)}
          </View>
        )}
      </Card>

      <Banner tone="info" title={sugText} />

      <View style={{ gap: space.sm }} accessibilityLabel="Logged sets">
        {done.map((s) => (
          <Row key={s.id} style={{ backgroundColor: color.okWash, borderRadius: 8, padding: space.sm, justifyContent: 'space-between' }}>
            <Row>
              <Icon name="check" size={18} stroke={color.ok} width={2.6} />
              <T>{`Set ${s.setIndex}: ${s.reps}${block.unit === 'seconds' ? ' s' : ''}${ex?.loaded ? ` × ${s.loadKg} kg` : ''}${s.rir !== undefined ? ` · ${s.rir} left` : ''}`}</T>
            </Row>
            <Row gap={4}>
              <Icon name="saved" size={16} stroke={color.ok} />
              <T v="small" style={{ color: color.ok }}>Saved on phone</T>
            </Row>
          </Row>
        ))}
        {done.length > 0 && <Button label="Undo last set" kind="ghost" onPress={() => removeSet(done.at(-1)!.id)} />}
      </View>

      {restLeft > 0 ? (
        <Card tone="sunken">
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h2">Rest</T>
            <T v="num" style={{ fontSize: 32, lineHeight: 36 }} accessibilityRole="text">{`${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, '0')}`}</T>
          </Row>
          <Button label="Skip rest" kind="secondary" onPress={() => setRestUntil(null)} />
        </Card>
      ) : (
        <Card>
          <T v="label">{`Set ${done.length + 1} of ${block.sets}`}</T>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: space.md }}>
            <View style={{ gap: 4 }}>
              <T v="small">{block.unit === 'seconds' ? 'Seconds' : 'Reps'}</T>
              <Stepper label={block.unit === 'seconds' ? 'Seconds' : 'Reps'} value={reps} min={0} max={block.unit === 'seconds' ? 300 : 100} step={block.unit === 'seconds' ? 5 : 1} onChange={setReps} />
            </View>
            {ex?.loaded && (
              <View style={{ gap: 4 }}>
                <T v="small">Load</T>
                <Stepper label="Load in kilograms" unit="kg" value={load} min={0} max={500} step={ex.allOf.includes('barbell') ? 2.5 : 0.5} onChange={setLoad} />
              </View>
            )}
          </Row>
          <T v="small">Reps left in the tank (optional)</T>
          <ChipGroup options={[0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n === 5 ? '5+' : String(n) }))} value={rir} onChange={setRir} />
          <Button label="Done set" icon="check" tall onPress={doneSet} />
        </Card>
      )}

      <Row style={{ flexWrap: 'wrap' }}>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Button label="Swap" kind="secondary" icon="swap" onPress={() => setShowSwap(!showSwap)} />
        </View>
        <View style={{ flex: 1, minWidth: 140 }}>
          <Button label="Skip exercise" kind="secondary" onPress={onSkip} />
        </View>
      </Row>
      {showSwap && (
        <Card>
          <T v="label">Alternatives that fit your equipment and limits</T>
          {subs.length === 0 ? (
            <T v="small">No safe alternative fits. You can skip this exercise instead.</T>
          ) : (
            subs.map((e) => (
              <Button key={e.id} label={e.name} kind="secondary" onPress={() => dispatch({ type: 'session', key: sessionKey, patch: { swaps: { ...(state.sessions[sessionKey]?.swaps ?? {}), [originalId]: e.id } } })} />
            ))
          )}
        </Card>
      )}
      <Button label="Something feels wrong?" kind="ghost" icon="alert" onPress={() => router.push({ pathname: '/pain', params: { session: sessionKey } })} />
      <Button label="End session early" kind="ghost" onPress={() => dispatch({ type: 'session', key: sessionKey, patch: { status: 'partial', endedAt: new Date().toISOString() } })} />
    </View>
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
        <T v="small" style={{ color: color.ink }}>{`${plural(sets.length, 'set')} across ${plural(byEx.length, 'exercise')}${log.feel ? ` · felt ${log.feel.replace('_', ' ')}` : ''}`}</T>
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
