import { COACH_MESSAGE_MAX, getCard } from '@ff/engines';
import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '../../src/icons';
import { ask, shortenPatch, swapPatch } from '../../src/lib/coach';
import { newId, useStore } from '../../src/store/store';
import type { CoachMessage } from '../../src/store/types';
import { BORDER, MIN_TOUCH, color, font, radius, space } from '../../src/theme';
import { Button, Card, Chip, Eyebrow, Row, T } from '../../src/ui';

const PROMPTS = ['What is today’s session?', 'I only have 20 minutes', 'Why is my plan like this?', 'How much protein do I need?'];

export default function Coach() {
  const { state, dispatch } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [openCard, setOpenCard] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const messages = state.coachMessages;

  const save = (list: CoachMessage[]) => dispatch({ type: 'patch', patch: { coachMessages: list } });

  async function send(message: string) {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    setText('');
    setBusy(true);
    const userMsg: CoachMessage = { id: newId(), role: 'user', text: trimmed.slice(0, COACH_MESSAGE_MAX), at: new Date().toISOString() };
    const withUser = [...messages, userMsg];
    save(withUser);
    try {
      const r = await ask(state, trimmed);
      if (r.safety === 'red_flag' || r.safety === 'crisis') {
        dispatch({ type: 'safety', event: { id: newId(), type: r.safety === 'crisis' ? 'crisis' : 'red_flag_symptom', at: new Date().toISOString(), detail: 'coach message' } });
      }
      if (r.safety === 'ed_signal' || r.safety === 'out_of_scope') {
        dispatch({ type: 'safety', event: { id: newId(), type: r.safety === 'ed_signal' ? 'ed_signal' : 'unsafe_request', at: new Date().toISOString(), detail: 'coach message' } });
      }
      save([...withUser, { id: newId(), role: 'coach', text: r.text, at: new Date().toISOString(), source: r.source, safety: r.safety, actions: r.actions, cardIds: r.cards.map((c) => c.id) }]);
    } catch {
      save([...withUser, { id: newId(), role: 'coach', text: 'Something went wrong on my side. Your plan and logs are unaffected; try again in a moment.', at: new Date().toISOString(), source: 'fallback' }]);
    } finally {
      setBusy(false);
      setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  function decide(msgId: string, i: number, decision: 'confirmed' | 'dismissed') {
    const msg = messages.find((m) => m.id === msgId);
    const action = msg?.actions?.[i];
    if (!msg || !action || action.decision) return;
    let outcome: 'confirmed' | 'dismissed' | 'failed' = decision;
    if (decision === 'confirmed') {
      if (action.type === 'shorten_session' || action.type === 'swap_exercise') {
        // Re-checked at confirm time: the session may have changed since the reply.
        const p =
          action.type === 'shorten_session'
            ? shortenPatch(state, Number(action.payload.minutes))
            : swapPatch(state, String(action.payload.from), String(action.payload.to));
        if (p) dispatch({ type: 'session', key: p.key, patch: p.patch });
        else outcome = 'failed';
      }
      if (action.type === 'show_evidence') setOpenCard(String(action.payload.card_id));
      if (action.type === 'escalate_safety') router.push({ pathname: '/safety', params: { kind: String(action.payload.kind) } });
    }
    save(messages.map((m) => (m.id === msgId ? { ...m, actions: m.actions!.map((a, j) => (j === i ? { ...a, decision: outcome } : a)) } : m)));
  }

  function feedback(msgId: string, f: CoachMessage['feedback']) {
    const msg = messages.find((m) => m.id === msgId);
    if (!msg || msg.feedback === f) return;
    save(messages.map((m) => (m.id === msgId ? { ...m, feedback: f } : m)));
    if (f === 'wrong') {
      // Files a report with the coach's reply only (never the user's own message), sent with the next backup.
      const at = new Date().toISOString();
      dispatch({ type: 'safety', event: { id: newId(), type: 'unsafe_request', at, detail: `reported coach reply ${msgId}` } });
      dispatch({ type: 'patch', patch: { reports: [...state.reports, { id: newId(), kind: 'unsafe_advice', text: 'Coach reply marked as wrong', at, context: { reply: msg.text.slice(0, 1500), source: msg.source ?? 'unknown' } }] } });
    }
  }

  const card = openCard ? getCard(openCard) : undefined;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, gap: space.md }} keyboardShouldPersistTaps="handled">
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="title">Coach</T>
            <Button label="What I know" kind="ghost" onPress={() => router.push('/memory')} />
          </Row>
          <T v="small">Answers come from your plan’s rules.</T>

          {messages.length === 0 && (
            <Card tone="sunken">
              <T v="small" style={{ color: color.ink }}>Ask about today, shorten a session, swap an exercise, or why your plan looks the way it does.</T>
            </Card>
          )}

          {messages.map((m) => (
            <View key={m.id} style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'user' ? (
                <View style={{ maxWidth: '85%', backgroundColor: color.primary, borderRadius: radius.card, borderWidth: BORDER, borderColor: color.line, padding: space.md }}>
                  <T style={{ color: color.onPrimary }}>{m.text}</T>
                </View>
              ) : (
                <View style={{ maxWidth: '92%', width: '92%' }}>
                  <Card tone={m.safety === 'red_flag' || m.safety === 'crisis' ? 'danger' : m.safety && m.safety !== 'routine' ? 'warn' : 'surface'}>
                    <Eyebrow>{m.source === 'model' ? 'AI wording, checked' : m.source === 'template' ? 'Safety' : 'From your plan’s rules'}</Eyebrow>
                    <T>{m.text}</T>
                    {m.actions?.map((a, i) => (
                      <View key={i} style={{ gap: space.xs }}>
                        {a.decision ? (
                          <T v="small">{`${a.label}: ${a.decision === 'confirmed' ? 'done' : a.decision === 'failed' ? 'could not apply, today’s session has changed' : 'not now'}`}</T>
                        ) : (
                          <Row>
                            <View style={{ flex: 1 }}>
                              <Button label={a.label} kind={a.type === 'escalate_safety' ? 'danger' : 'secondary'} onPress={() => decide(m.id, i, 'confirmed')} />
                            </View>
                            {a.type !== 'escalate_safety' && a.type !== 'show_evidence' && <Button label="Not now" kind="ghost" onPress={() => decide(m.id, i, 'dismissed')} />}
                          </Row>
                        )}
                      </View>
                    ))}
                    {m.cardIds?.map((id) => {
                      const c = getCard(id);
                      return c ? <Chip key={id} label={`Source: ${c.title}`} onPress={() => setOpenCard(openCard === id ? null : id)} /> : null;
                    })}
                    {/* One quiet way to flag a bad answer, instead of a row of buttons under every reply. */}
                    {m.feedback === 'wrong' ? (
                      <T v="small">Thanks. Reported for review.</T>
                    ) : (
                      <Pressable accessibilityRole="button" accessibilityLabel="Report this answer as wrong" onPress={() => feedback(m.id, 'wrong')} hitSlop={8} style={{ alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' }}>
                        <T v="small" style={{ textDecorationLine: 'underline' }}>Wrong answer?</T>
                      </Pressable>
                    )}
                  </Card>
                </View>
              )}
            </View>
          ))}

          {card && (
            <Card tone="sunken">
              <Eyebrow>{card.status === 'draft' ? 'Evidence card, draft' : 'Evidence card'}</Eyebrow>
              <T v="h2">{card.title}</T>
              <T>{card.summary}</T>
              <T v="small">{`Applies to: ${card.appliesTo}. Limits: ${card.limits}`}</T>
              <T v="small">{`Source: ${card.citation} (${card.sourceDate}). Strength: ${card.strength}.`}</T>
              <Button label="Close" kind="ghost" onPress={() => setOpenCard(null)} />
            </Card>
          )}
          {busy && <T v="small">Thinking...</T>}
        </ScrollView>

        <View style={{ padding: space.md, gap: space.sm, borderTopWidth: BORDER, borderTopColor: color.line, backgroundColor: color.surface }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {PROMPTS.map((p) => <Chip key={p} label={p} onPress={() => send(p)} />)}
          </ScrollView>
          <Row>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Ask your coach"
              placeholderTextColor={color.muted}
              accessibilityLabel="Message your coach"
              maxLength={COACH_MESSAGE_MAX}
              onSubmitEditing={() => send(text)}
              style={{ flex: 1, minHeight: MIN_TOUCH, borderWidth: BORDER, borderColor: color.line, borderRadius: radius.card, paddingHorizontal: space.md, fontFamily: font.regular, fontSize: 16, color: color.ink }}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={() => send(text)} disabled={busy} style={{ width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: radius.card, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center', borderWidth: BORDER, borderColor: color.line }}>
              <Icon name="chevron" stroke={color.onPrimary} />
            </Pressable>
          </Row>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
