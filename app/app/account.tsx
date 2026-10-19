import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { backendConfigured, callFunction, supabase } from '../src/lib/backend';
import { OTHER_ACCOUNT } from '../src/lib/BackendSync';
import { shareJson } from '../src/lib/share';
import { requestPush, resolveConflict, restore } from '../src/lib/sync';
import { useStore } from '../src/store/store';
import { color, space } from '../src/theme';
import { Banner, Button, Card, Field, Row, Screen, T } from '../src/ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Backup account (S44 and plan/15): email code sign-in, backup, restore, conflicts, server export and deletion. */
export default function Account() {
  const { state, dispatch, importSets, removeSet, getState } = useStore();
  const [email, setEmail] = useState(state.account?.email ?? '');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: 'ok' | 'warn' | 'danger' | 'info'; title: string; body?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote({ tone: 'danger', title: 'That did not work', body: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  // When confirming for deletion, the code must go to the signed-in account's own address.
  const target = needsReauth && state.account ? state.account.email : email.trim();

  const sendCode = () =>
    run(async () => {
      if (!EMAIL.test(target)) throw new Error('Enter a valid email address.');
      const { error } = await supabase!.auth.signInWithOtp({ email: target, options: { shouldCreateUser: !needsReauth } });
      if (error) throw new Error(error.message);
      setStage('code');
      setNote({ tone: 'info', title: 'Check your email', body: 'Enter the 6-digit code we sent. It expires in a few minutes.' });
    });

  const verify = () =>
    run(async () => {
      const { error } = await supabase!.auth.verifyOtp({ email: target, token: code.trim(), type: 'email' });
      if (error) throw new Error('That code did not work. Check it or ask for a new one.');
      setCode('');
      setStage('email');
      if (needsReauth) {
        setNeedsReauth(false);
        setConfirmDelete(true);
        setNote({ tone: 'warn', title: 'Confirmed. You can delete your account now.' });
      } else setNote({ tone: 'ok', title: 'Signed in', body: 'Backup starts in a few seconds.' });
    });

  const backupNow = () =>
    run(async () => {
      const r = await requestPush(getState, dispatch);
      if (!r.ok) throw new Error(`${r.errors.join('; ')}. Your data on this phone is safe.`);
      setNote({ tone: 'ok', title: 'Backup finished' });
    });

  const restoreNow = () =>
    run(async () => {
      const r = await restore(getState, dispatch, importSets, { link: !state.sync.linkedUserId });
      setNote({
        tone: r.conflicts ? 'warn' : 'ok',
        title: `Restored ${r.sessions} workouts, ${r.sets} sets, ${r.checkIns} check-ins and ${r.meals} meals`,
        body: r.conflicts ? `${r.conflicts} workouts differ between this phone and the backup. Choose below.` : undefined,
      });
    });

  const exportServer = () =>
    run(async () => {
      const { data, error } = await callFunction<unknown>('privacy', { type: 'export' });
      if (error) throw new Error(error.message);
      const json = JSON.stringify(data, null, 2);
      setExported(json);
      await shareJson('form-and-flow-server-data.json', json);
    });

  const deleteAccount = () =>
    run(async () => {
      const { error } = await callFunction<{ deleted: boolean }>('privacy', { type: 'deletion' });
      if (error?.code === 'REAUTH_REQUIRED') {
        setConfirmDelete(false);
        setNeedsReauth(true);
        setStage('email');
        setNote({ tone: 'warn', title: 'Confirm it is you', body: 'Send yourself a new code, then delete.' });
        return;
      }
      if (error) throw new Error(error.message);
      await supabase!.auth.signOut({ scope: 'local' });
      dispatch({ type: 'patch', patch: { account: undefined, sync: { ids: {}, conflicts: [], deleted: [] } } });
      setConfirmDelete(false);
      setNote({ tone: 'ok', title: 'Your account and backup are deleted', body: 'Everything on this phone is still here. A hashed security record is kept for one year, as the law requires.' });
    });

  const signedIn = !!state.account;
  const showCodeForm = !signedIn || needsReauth;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Button label="Back" kind="ghost" icon="back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))} />
      </Row>
      <T v="title">Backup and account</T>

      {!backendConfigured ? (
        <Card>
          <T v="h2">Backup is not set up in this build</T>
          <T v="small">Everything stays on this phone. Use Export in Settings to keep a copy.</T>
        </Card>
      ) : (
        <>
          <Card tone="sunken">
            <T v="small" style={{ color: color.ink }}>
              Backup copies your profile, safety answers and limits, workouts, check-ins, meals, food settings and problem reports to your account, so you can restore them on a new phone. Your coach chat stays on this phone.
            </T>
          </Card>

          {note && <Banner tone={note.tone} title={note.title} body={note.body} />}

          {showCodeForm && (
            <Card>
              <T v="h2">{needsReauth ? 'Confirm with a new code' : 'Sign in with your email'}</T>
              {stage === 'email' ? (
                <>
                  {needsReauth ? (
                    <T v="small" style={{ color: color.ink }}>{`We will send a code to ${target}.`}</T>
                  ) : (
                    <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                  )}
                  <Button label={busy ? 'Sending...' : 'Send code'} onPress={sendCode} disabled={busy} />
                  <T v="small">No password. We email you a one-time code. New here? This creates your account.</T>
                </>
              ) : (
                <>
                  <Field label="6-digit code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" />
                  <Button label={busy ? 'Checking...' : 'Confirm'} onPress={verify} disabled={busy || code.length !== 6} />
                  {!needsReauth && <Button label="Use a different email" kind="ghost" onPress={() => setStage('email')} />}
                </>
              )}
            </Card>
          )}

          {signedIn && (
            <>
              <Card>
                <T v="h2">Signed in</T>
                <T v="small" style={{ color: color.ink }}>{state.account!.email}</T>
                <T v="small">{state.sync.lastAt ? `Last backup: ${new Date(state.sync.lastAt).toLocaleString()}` : 'Not backed up yet.'}</T>
                {state.sync.lastError === OTHER_ACCOUNT ? (
                  <Banner tone="danger" title="Backup is paused" body={OTHER_ACCOUNT} />
                ) : (
                  state.sync.lastError && <Banner tone="warn" title="Last backup had a problem" body={`${state.sync.lastError}. Your data on this phone is safe; it will try again.`} />
                )}
                {!state.sync.linkedUserId && !state.sync.lastError && <T v="small">Reading your backup before the first upload...</T>}
                <Button label="Back up now" kind="secondary" onPress={backupNow} disabled={busy} />
                <Button label="Restore from backup" kind="secondary" onPress={restoreNow} disabled={busy} />
                <Button label="Sign out" kind="ghost" onPress={() => run(async () => { await supabase!.auth.signOut(); })} disabled={busy} />
              </Card>

              {state.sync.conflicts.length > 0 && (
                <Card tone="warn">
                  <T v="h2">Workouts to settle</T>
                  <T v="small" style={{ color: color.ink }}>These workouts were saved differently on this phone and in the backup. Nothing is lost until you choose.</T>
                  {state.sync.conflicts.map((c) => (
                    <View key={`${c.key}|${c.backup.opId}`} style={{ gap: space.xs }}>
                      <T v="small" style={{ color: color.ink }}>{`${c.backup.session.startedAt.slice(0, 10)}: this phone has ${c.phone.sets} sets (${c.phone.status.replace('_', ' ')}); the backup has ${c.backup.sets.length} sets (${c.backup.status.replace('_', ' ')}).`}</T>
                      <Row>
                        <Button label="Keep this phone's" kind="secondary" onPress={() => run(() => resolveConflict(getState, c, 'phone', dispatch, { importSets, removeSet }))} disabled={busy} />
                        <Button label="Keep backup" kind="ghost" onPress={() => run(() => resolveConflict(getState, c, 'backup', dispatch, { importSets, removeSet }))} disabled={busy} />
                      </Row>
                    </View>
                  ))}
                </Card>
              )}

              <Card>
                <T v="h2">Your server data</T>
                <Button label="Download a copy" kind="secondary" onPress={exportServer} disabled={busy} />
                {exported && (
                  <Card tone="sunken">
                    <T v="small">{`Saved or shared as a file (${Math.ceil(exported.length / 1024)} KB). The first part:`}</T>
                    <T v="small" selectable style={{ color: color.ink }}>{exported.slice(0, 1500)}{exported.length > 1500 ? '\n…' : ''}</T>
                  </Card>
                )}
                {!confirmDelete ? (
                  <Button label="Delete my account and backup" kind="secondary" onPress={() => setConfirmDelete(true)} disabled={busy} />
                ) : (
                  <View style={{ gap: space.sm }}>
                    <Banner tone="danger" title="This cannot be undone" body="Your account and everything in the backup are erased. This phone keeps its own copy until you delete it in Settings." />
                    <Button label="Yes, delete my account" kind="danger" onPress={deleteAccount} disabled={busy} />
                    <Button label="Cancel" kind="ghost" onPress={() => setConfirmDelete(false)} />
                  </View>
                )}
              </Card>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
