import { EXERCISES, type Pattern } from '@ff/engines';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Icon } from '../../src/icons';
import { ExerciseVideo } from '../../src/media/ExerciseVideo';
import { equipmentText } from '../../src/lib/equipment';
import { sentence } from '../../src/lib/limits';
import { currentPlan, effectiveSession, plural, todayIndex } from '../../src/lib/plan';
import { useStore } from '../../src/store/store';
import { BORDER, MIN_TOUCH, color, font, radius, space } from '../../src/theme';
import { Button, Card, Eyebrow, Row, Screen, T } from '../../src/ui';

const DAY = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PATTERN: Record<Pattern, string> = {
  squat: 'Squat', hinge: 'Hinge', lunge: 'Lunge', push_h: 'Push', push_v: 'Overhead push', pull_h: 'Row', pull_v: 'Pull down', core: 'Core', carry: 'Carry', mobility: 'Mobility',
};

/** Forgiving search: lowercase, no punctuation, and small typos ("sqaut") still match. */
function matches(q: string, text: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '');
  const a = norm(q).trim();
  if (!a) return true;
  const hay = norm(text);
  if (hay.includes(a)) return true;
  const sorted = (s: string) => s.split('').sort().join('');
  return hay.split(' ').some((w) => w.length === a.length && sorted(w) === sorted(a));
}

export default function Train() {
  const { state } = useStore();
  const plan = currentPlan(state);
  const today = todayIndex(state);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);
  // The next session to do: today's if it is not finished, otherwise the next one this week.
  const next = plan?.week.sessions.find((s) => s.day >= today && state.sessions[s.id]?.status !== 'completed' && state.sessions[s.id]?.status !== 'partial');
  const list = useMemo(() => EXERCISES.filter((e) => e.pattern !== 'mobility' && matches(q, [e.name, ...e.aliases].join(' '))), [q]);

  return (
    <Screen>
      <T v="title">Train</T>
      <T v="label">This week</T>
      {plan?.week.paused ? (
        <Card tone="warn">
          <T v="h2">Training is paused</T>
          <T v="small" style={{ color: color.ink }}>Resolve the safety step in Settings to unlock your plan.</T>
        </Card>
      ) : (
        plan?.week.sessions.map((s) => {
          const log = state.sessions[s.id];
          const eff = effectiveSession(s, log);
          const openSession = () => router.push({ pathname: '/session/[key]', params: { key: s.id } });
          if (s.id === next?.id) {
            // The next session stands out, with its own button.
            return (
              <Card key={s.id}>
                <Eyebrow>{s.day === today ? 'Next: today' : `Next: ${DAY[s.day]}`}</Eyebrow>
                <T v="h2">{s.title}</T>
                <T v="small">{`About ${eff.estimatedMinutes} min · ${plural(eff.blocks.length, 'exercise')}`}</T>
                <Button label={log?.status === 'in_progress' ? 'Resume session' : 'Open session'} tall onPress={openSession} />
              </Card>
            );
          }
          return (
            <Pressable key={s.id} accessibilityRole="button" accessibilityLabel={`${DAY[s.day]}: ${s.title}, about ${eff.estimatedMinutes} minutes${log?.status === 'completed' ? ', done' : ''}`} onPress={openSession}>
              <Card tone={log?.status === 'completed' ? 'ok' : 'surface'}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Eyebrow>{s.day === today ? 'Today' : DAY[s.day]!}</Eyebrow>
                  {log?.status === 'completed' ? <Icon name="check" stroke={color.ok} width={2.6} /> : <Icon name="chevron" />}
                </Row>
                <T v="h2">{s.title}</T>
                <T v="small">{`About ${eff.estimatedMinutes} min · ${plural(eff.blocks.length, 'exercise')}`}</T>
              </Card>
            </Pressable>
          );
        })
      )}
      <Card tone="sunken">
        <T v="small" style={{ color: color.ink }}>{plan?.week.reasons.map((r) => sentence(r.text)).join(' ')}</T>
      </Card>

      <Button label={browsing ? 'Hide exercises' : `Browse exercises (${list.length})`} kind="secondary" icon="search" onPress={() => setBrowsing(!browsing)} />
      {browsing && (
        <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: BORDER, borderColor: color.line, borderRadius: radius.card, backgroundColor: color.surface, paddingHorizontal: space.md, minHeight: MIN_TOUCH }}>
          <Icon name="search" size={18} stroke={color.muted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search, for example squat or row" placeholderTextColor={color.muted} accessibilityLabel="Search exercises" style={{ flex: 1, fontFamily: font.regular, fontSize: 16, color: color.ink }} />
        </View>
        {list.length === 0 && <T v="small">No match. Try a shorter word.</T>}
        {list.map((e) => (
          <Card key={e.id}>
            {/* Only the header toggles, so the demo's own tap target is not nested in another button. */}
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open === e.id }} onPress={() => setOpen(open === e.id ? null : e.id)} style={{ gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="h2">{e.name}</T>
                <T v="small">{`Level ${e.level}`}</T>
              </Row>
              <T v="small">{`${PATTERN[e.pattern]} · ${equipmentText(e.anyOf, e.allOf)}`}</T>
            </Pressable>
            {open === e.id && (
              <View style={{ gap: 4 }}>
                <ExerciseVideo exerciseId={e.id} name={e.name} />
                {e.cues.map((c) => <T key={c} v="small" style={{ color: color.ink }}>{`• ${c}`}</T>)}
                {e.reviewStatus === 'draft' && <Eyebrow>Draft, not yet reviewed</Eyebrow>}
              </View>
            )}
          </Card>
        ))}
        </>
      )}
    </Screen>
  );
}
