import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { COACH_MODELS } from '@ff/engines';
import { addDays, makePlan, todayKey } from '../src/lib/plan';
import { backendConfigured, supabase } from '../src/lib/backend';
import { shareJson } from '../src/lib/share';
import { remindersSupported, requestReminderPermission } from '../src/lib/notify';
import { newId, useStore } from '../src/store/store';
import { AI_NOTICE, NOTICE_VERSION, type ProblemReport } from '../src/store/types';
import { color, space } from '../src/theme';
import { Banner, Button, Card, Chip, ChipGroup, Field, Row, Screen, T } from '../src/ui';

const REPORT_KINDS: { value: ProblemReport['kind']; label: string }[] = [
  { value: 'unsafe_advice', label: 'Unsafe or wrong advice' },
  { value: 'wrong_food_data', label: 'Wrong food data' },
  { value: 'bug', label: 'Something broke' },
  { value: 'account', label: 'Account or data' },
];

export default function Settings() {
  const { state, dispatch, resetAll } = useStore();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCleared, setConfirmCleared] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [reportKind, setReportKind] = useState<ProblemReport['kind']>('bug');
  const [reportText, setReportText] = useState('');
  const [reportSent, setReportSent] = useState(false);
  const today = todayKey(state.profile?.timezone ?? 'Asia/Kolkata');
  const setCategory = (c: 'session' | 'weekly_review' | 'check_in') =>
    dispatch({ type: 'patch', patch: { reminders: { ...state.reminders, categories: { ...state.reminders.categories, [c]: !state.reminders.categories[c] } } } });
  const hasRedFlag = state.restrictions.some((r) => r.code === 'red_flag' || r.code === 'clearance_required');

  function exportData() {
    const { hydrated: _h, draft: _d, ...data } = state;
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'Form & Flow', ...data }, null, 2);
    setExported(json);
    shareJson('form-and-flow-phone-data.json', json).catch(() => undefined);
  }

  function sendReport() {
    const text = reportText.trim();
    if (!text) return;
    const report: ProblemReport = { id: newId(), kind: reportKind, text: text.slice(0, 2000), at: new Date().toISOString() };
    dispatch({ type: 'patch', patch: { reports: [...state.reports, report] } });
    setReportText('');
    setReportSent(true);
  }

  function clearedByDoctor() {
    const restrictions = state.restrictions.filter((r) => r.code !== 'red_flag' && r.code !== 'clearance_required');
    const next = { ...state, restrictions };
    dispatch({ type: 'patch', patch: { restrictions, plan: makePlan(next, (state.plan?.version ?? 0) + 1) && { ...makePlan(next, (state.plan?.version ?? 0) + 1)!, acceptedAt: new Date().toISOString() } } });
    setConfirmCleared(false);
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="Back" kind="ghost" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Row>
      <T v="title">Settings</T>

      <Card>
        <T v="h2">Your setup</T>
        <T v="small">Change your goal, equipment, days or safety answers. Your logged history is kept.</T>
        <Button label="Redo setup" kind="secondary" onPress={() => dispatch({ type: 'patch', patch: { onboarded: false, draft: { ...state.draft, step: 2 } } })} />
      </Card>

      <Card>
        <T v="h2">Safety</T>
        {state.restrictions.length === 0 ? (
          <T v="small">No limits are active.</T>
        ) : (
          state.restrictions.map((r) => (
            <T key={r.code} v="small" style={{ color: color.ink }}>{`${r.code.replace('region:', 'Leave out: ').replace(/_/g, ' ')}${r.expiresAt ? ` (until ${r.expiresAt})` : ''}`}</T>
          ))
        )}
        {hasRedFlag && !confirmCleared && <Button label="A doctor has checked me" kind="secondary" onPress={() => setConfirmCleared(true)} />}
        {confirmCleared && (
          <View style={{ gap: space.sm }}>
            <Banner tone="warn" title="Only confirm if a doctor has actually cleared you for exercise." />
            <Button label="Yes, I have been cleared" onPress={clearedByDoctor} />
            <Button label="Cancel" kind="ghost" onPress={() => setConfirmCleared(false)} />
          </View>
        )}
      </Card>

      <Card>
        <T v="h2">Reminders</T>
        <T v="small">Off unless you turn them on. Never during quiet hours ({state.reminders.quietStart} to {state.reminders.quietEnd}), never for a session you have done, at most 5 a week.</T>
        {!remindersSupported && <T v="small">Reminders work in the phone app, not in this web preview.</T>}
        {permissionDenied && <Banner tone="info" title="Notifications are off for this app" body="Everything still works. You can allow notifications in your phone settings at any time." />}
        <Chip
          label={state.reminders.enabled ? 'Reminders on' : 'Reminders off'}
          selected={state.reminders.enabled}
          onPress={async () => {
            if (state.reminders.enabled) return dispatch({ type: 'patch', patch: { reminders: { ...state.reminders, enabled: false } } });
            const granted = remindersSupported ? await requestReminderPermission() : true;
            setPermissionDenied(!granted);
            dispatch({ type: 'patch', patch: { reminders: { ...state.reminders, enabled: true } } });
          }}
        />
        {state.reminders.enabled && (
          <View style={{ gap: space.sm }}>
            <Row style={{ flexWrap: 'wrap' }}>
              <Chip label="Sessions" selected={state.reminders.categories.session} onPress={() => setCategory('session')} />
              <Chip label="Weekly review" selected={state.reminders.categories.weekly_review} onPress={() => setCategory('weekly_review')} />
              <Chip label="Daily check-in" selected={state.reminders.categories.check_in} onPress={() => setCategory('check_in')} />
            </Row>
            <T v="label">Session reminder time</T>
            <ChipGroup options={['07:00', '12:00', '18:00', '20:00'].map((t) => ({ value: t, label: t }))} value={state.reminders.sessionTime} onChange={(sessionTime) => dispatch({ type: 'patch', patch: { reminders: { ...state.reminders, sessionTime } } })} />
            <Button
              label={state.reminders.pausedUntil && state.reminders.pausedUntil > today ? `Paused until ${state.reminders.pausedUntil}. Resume now` : 'Pause for 7 days'}
              kind="secondary"
              onPress={() => dispatch({ type: 'patch', patch: { reminders: { ...state.reminders, pausedUntil: state.reminders.pausedUntil && state.reminders.pausedUntil > today ? undefined : addDays(today, 7) } } })}
            />
          </View>
        )}
      </Card>

      <Card>
        <T v="h2">Backup</T>
        <T v="small">
          {!backendConfigured
            ? 'Backup is not set up in this build. Everything stays on this phone.'
            : state.account
              ? `On, signed in as ${state.account.email}.${state.sync.lastError ? ' The last backup failed; it will retry.' : ''}`
              : 'Off. Turn it on to restore your workouts on a new phone.'}
        </T>
        {backendConfigured && <Button label={state.account ? 'Manage backup' : 'Set up backup'} kind="secondary" onPress={() => router.push('/account')} />}
      </Card>

      <Card>
        <T v="h2">Report a problem</T>
        <ChipGroup options={REPORT_KINDS} value={reportKind} onChange={setReportKind} />
        <Field label="What happened?" value={reportText} onChangeText={(t) => { setReportText(t); setReportSent(false); }} multiline maxLength={2000} />
        <Button label="Send report" kind="secondary" onPress={sendReport} disabled={!reportText.trim()} />
        {reportSent && (
          <Banner
            tone="ok"
            title="Report saved"
            body={state.account ? 'It goes to the team with your next backup.' : 'It is saved on this phone and goes to the team once you turn on backup.'}
          />
        )}
      </Card>

      <Card>
        <T v="h2">Privacy</T>
        <T v="small">{`Data use agreed: ${state.consents?.at.slice(0, 10) ?? 'not yet'} (notice ${state.consents?.version ?? '-'}). ${state.account ? 'Stored on this phone and in your backup.' : 'Stored on this phone only.'} AI coach wording needs both backup and AI processing on; the AI never sees other people's data.`}</T>
        <Chip
          label={state.consents?.aiProcessing ? 'AI processing allowed' : 'AI processing not allowed'}
          selected={!!state.consents?.aiProcessing}
          // Changing the choice re-records consent under the current notice.
          onPress={() => state.consents && dispatch({ type: 'patch', patch: { consents: { ...state.consents, aiProcessing: !state.consents.aiProcessing, version: NOTICE_VERSION, at: new Date().toISOString() } } })}
        />
        <T v="small">{AI_NOTICE}</T>
        {state.consents?.aiProcessing && (
          <View style={{ gap: space.sm }}>
            <T v="label">AI model for coach wording</T>
            <ChipGroup options={COACH_MODELS.map((m) => ({ value: m.id, label: m.label }))} value={state.coachModel} onChange={(coachModel) => dispatch({ type: 'patch', patch: { coachModel } })} />
            <T v="small">{`${COACH_MODELS.find((m) => m.id === state.coachModel)?.note ?? ''} Every model follows the same safety rules, and the app checks every number it writes.`}</T>
          </View>
        )}
        <Button label="Export my data" kind="secondary" onPress={exportData} />
        {exported && (
          <Card tone="sunken">
            <T v="small">{`Saved or shared as a file (${Math.ceil(exported.length / 1024)} KB). The first part:`}</T>
            <T v="small" selectable style={{ color: color.ink }}>{exported.slice(0, 1500)}{exported.length > 1500 ? '\n…' : ''}</T>
          </Card>
        )}
        {!confirmDelete ? (
          <Button label="Delete everything on this phone" kind="secondary" onPress={() => setConfirmDelete(true)} />
        ) : (
          <View style={{ gap: space.sm }}>
            <Banner
              tone="danger"
              title="This cannot be undone"
              body={`Your profile, plan, safety answers and every logged set will be erased from this phone.${state.account ? ' Your backup is not deleted: do that first in Backup if you want it gone too.' : ''}`}
            />
            <Button
              label="Yes, delete everything"
              kind="danger"
              onPress={async () => {
                if (supabase && state.account) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
                await resetAll();
                router.replace('/onboarding');
              }}
            />
            <Button label="Cancel" kind="ghost" onPress={() => setConfirmDelete(false)} />
          </View>
        )}
      </Card>
      <T v="small">Form & Flow is a wellness coach, not medical advice. Pilot build 0.1.0.</T>
    </Screen>
  );
}
