/**
 * Row-level security tests against an in-process Postgres (PGlite), because this machine has no
 * Docker for a local Supabase stack. auth.users, auth.uid() and the authenticated role are stubbed
 * to behave like Supabase. Run: npm run test:db
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { before, test } from 'node:test';
import { PGlite, type Transaction } from '@electric-sql/pglite';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const db = new PGlite();

const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  grant usage on schema public, auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
`;

before(async () => {
  await db.exec(SUPABASE_STUB);
  const dir = join(import.meta.dirname, '..', 'migrations');
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) await db.exec(readFileSync(join(dir, f), 'utf8'));
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
});

async function asUser<T>(id: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec('set local role authenticated');
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [id]);
    return fn(tx);
  });
}

async function rejects(p: Promise<unknown>, pattern?: RegExp) {
  await assert.rejects(p, pattern);
}

test('every user-owned table has RLS enabled and forced', async () => {
  const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
    `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'`,
  );
  for (const row of r.rows) assert.equal(row.relrowsecurity, true, `${row.relname} has RLS`);
  assert.ok(r.rows.length >= 14);
});

test('a user can create and read their own profile', async () => {
  await asUser(A, (tx) => tx.query(`insert into profiles (user_id, birth_year) values ($1, 1990)`, [A]));
  const r = await asUser(A, (tx) => tx.query(`select user_id from profiles`));
  assert.equal(r.rows.length, 1);
});

test("user B cannot read user A's profile", async () => {
  const r = await asUser(B, (tx) => tx.query(`select * from profiles`));
  assert.equal(r.rows.length, 0);
});

test('user B cannot insert a row claiming to be user A', async () => {
  await rejects(asUser(B, (tx) => tx.query(`insert into profiles (user_id, birth_year) values ($1, 1990)`, [A])), /row-level security/);
});

test("user B's update of user A's row changes nothing", async () => {
  const r = await asUser(B, (tx) => tx.query(`update profiles set display_name = 'x' where user_id = $1`, [A]));
  assert.equal(r.affectedRows ?? 0, 0);
});

test('consent records are append-only for the user', async () => {
  await asUser(A, (tx) => tx.query(`insert into consent_records (user_id, purpose, notice_version, granted) values ($1, 'core', 'v1', true)`, [A]));
  await rejects(asUser(A, (tx) => tx.query(`update consent_records set granted = false`)), /permission denied/);
  await rejects(asUser(A, (tx) => tx.query(`delete from consent_records`)), /permission denied/);
});

test('the deletion ledger and audit log are not reachable by users', async () => {
  await rejects(asUser(A, (tx) => tx.query(`select * from deletion_ledger`)), /permission denied/);
  await rejects(asUser(A, (tx) => tx.query(`select * from audit_events`)), /permission denied/);
});

test("a user cannot add sets to someone else's workout", async () => {
  const sessionB = await asUser(B, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into workout_sessions (user_id, tz, client_op_id) values ($1, 'Asia/Kolkata', gen_random_uuid()) returning id`,
      [B],
    );
    return r.rows[0]!.id;
  });
  await rejects(
    asUser(A, (tx) =>
      tx.query(`insert into exercise_sets (user_id, session_id, exercise_id, set_index, reps, client_op_id) values ($1, $2, 'bw_squat', 1, 10, gen_random_uuid())`, [A, sessionB]),
    ),
    /row-level security/,
  );
});

test('retrying the same client operation does not duplicate a set', async () => {
  const op = '11111111-1111-4111-8111-111111111111';
  const count = await asUser(A, async (tx) => {
    const s = await tx.query<{ id: string }>(
      `insert into workout_sessions (user_id, tz, client_op_id) values ($1, 'Asia/Kolkata', gen_random_uuid()) returning id`,
      [A],
    );
    const sid = s.rows[0]!.id;
    for (let i = 0; i < 2; i++) {
      await tx.query(
        `insert into exercise_sets (user_id, session_id, exercise_id, set_index, reps, load_kg, client_op_id)
         values ($1, $2, 'goblet_squat', 1, 12, 16, $3) on conflict (user_id, client_op_id) do nothing`,
        [A, sid, op],
      );
    }
    const r = await tx.query<{ n: number }>(`select count(*)::int as n from exercise_sets where client_op_id = $1`, [op]);
    return r.rows[0]!.n;
  });
  assert.equal(count, 1);
});

test('only one workout can be in progress per user', async () => {
  await rejects(
    asUser(B, (tx) => tx.query(`insert into workout_sessions (user_id, tz, client_op_id) values ($1, 'Asia/Kolkata', gen_random_uuid())`, [B])),
    /duplicate key/,
  );
});

test('impossible values are rejected by the database', async () => {
  await rejects(asUser(A, (tx) => tx.query(`insert into progress_entries (user_id, metric, value, measured_at, tz, client_op_id) values ($1, 'weight_kg', 18, now(), 'Asia/Kolkata', gen_random_uuid())`, [A])), /check constraint/);
  await rejects(asUser(A, (tx) => tx.query(`insert into restrictions (user_id, code, source) values ($1, 'anything_goes', 'user')`, [A])), /check constraint/);
});

test('one check-in per day per user', async () => {
  await asUser(A, (tx) => tx.query(`insert into check_ins (user_id, day, energy, client_op_id) values ($1, '2026-10-19', 4, gen_random_uuid())`, [A]));
  await rejects(asUser(A, (tx) => tx.query(`insert into check_ins (user_id, day, energy, client_op_id) values ($1, '2026-10-19', 3, gen_random_uuid())`, [A])), /duplicate key/);
});

/* ---------- 0002: nutrition, reports, server-only records ---------- */

async function mealFor(id: string) {
  return asUser(id, async (tx) => {
    const r = await tx.query<{ id: string }>(
      `insert into meal_logs (user_id, eaten_at, day, tz, meal_type, source, client_op_id)
       values ($1, now(), '2026-10-19', 'Asia/Kolkata', 'lunch', 'search', gen_random_uuid()) returning id`,
      [id],
    );
    return r.rows[0]!.id;
  });
}

const item = (meal: string) =>
  `insert into meal_log_items (user_id, meal_log_id, food_id, name, qty, unit, grams, nutrients_snapshot, client_op_id)
   values ($1, '${meal}', 'dal_tadka', 'Dal tadka', 1, 'katori', 150, '{"energy_kcal":{"low":150,"high":210}}', gen_random_uuid())`;

test('a user can log a meal with items and read it back', async () => {
  const meal = await mealFor(A);
  await asUser(A, (tx) => tx.query(item(meal), [A]));
  const r = await asUser(A, (tx) => tx.query(`select * from meal_log_items`));
  assert.equal(r.rows.length, 1);
  const other = await asUser(B, (tx) => tx.query(`select * from meal_log_items`));
  assert.equal(other.rows.length, 0);
});

test("a user cannot add items to someone else's meal", async () => {
  const mealB = await mealFor(B);
  await rejects(asUser(A, (tx) => tx.query(item(mealB), [A])), /row-level security/);
});

test('meal portions outside sane bounds are rejected', async () => {
  const meal = await mealFor(A);
  await rejects(asUser(A, (tx) => tx.query(item(meal).replace("1, 'katori', 150", "1, 'katori', 9000"), [A])), /check constraint/);
});

test('problem reports are append-only and private', async () => {
  await asUser(A, (tx) => tx.query(`insert into reports (user_id, kind, text, app_version, client_op_id) values ($1, 'unsafe_advice', 'Coach said to train through pain', '0.1.0', gen_random_uuid())`, [A]));
  await rejects(asUser(A, (tx) => tx.query(`update reports set status = 'closed'`)), /permission denied/);
  await rejects(asUser(A, (tx) => tx.query(`delete from reports`)), /permission denied/);
  const r = await asUser(B, (tx) => tx.query(`select * from reports`));
  assert.equal(r.rows.length, 0);
});

test('model runs, the security log and privacy requests cannot be written by users', async () => {
  await rejects(asUser(A, (tx) => tx.query(`select * from model_runs`)), /permission denied/);
  await rejects(asUser(A, (tx) => tx.query(`insert into model_runs (user_id, purpose, model, prompt_version, schema_valid) values ($1, 'coach_turn', 'm', 'v', true)`, [A])), /permission denied/);
  await rejects(asUser(A, (tx) => tx.query(`select * from security_log`)), /permission denied/);
  await rejects(asUser(A, (tx) => tx.query(`insert into privacy_requests (user_id, type) values ($1, 'deletion')`, [A])), /permission denied/);
});

test('users cannot run the retention purge', async () => {
  await rejects(asUser(A, (tx) => tx.query(`select purge_expired()`)), /permission denied/);
});

test('deleting an account removes its data but keeps the hashed security log', async () => {
  const C = '00000000-0000-4000-8000-00000000000c';
  await db.exec(`insert into auth.users (id) values ('${C}')`);
  await mealFor(C);
  await db.query(`insert into model_runs (user_id, purpose, model, prompt_version, schema_valid) values ($1, 'coach_turn', 'm', 'v', true)`, [C]);
  await db.query(`insert into security_log (user_ref, event) values (hash_user_id($1), 'deletion')`, [C]);
  await db.query(`insert into deletion_ledger (user_id_hash) values (hash_user_id($1))`, [C]);
  await db.query(`delete from auth.users where id = $1`, [C]);
  const left = await db.query<{ n: number }>(
    `select (select count(*) from meal_logs where user_id = $1) + (select count(*) from model_runs where user_id = $1) as n`,
    [C],
  );
  assert.equal(Number(left.rows[0]!.n), 0);
  const log = await db.query(`select * from security_log where user_ref = hash_user_id($1)`, [C]);
  assert.equal(log.rows.length, 1);
  assert.ok(!JSON.stringify(log.rows).includes(C), 'no raw user ID in the log');
});

/* ---------- 0003: hardening ---------- */

test('the database stamps consent time, so a future-dated grant cannot outrank a withdrawal', async () => {
  await asUser(A, (tx) => tx.query(`insert into consent_records (user_id, purpose, notice_version, granted, at, client_at) values ($1, 'ai_processing', 'v1', true, '2099-01-01', '2099-01-01')`, [A]));
  await asUser(A, (tx) => tx.query(`insert into consent_records (user_id, purpose, notice_version, granted) values ($1, 'ai_processing', 'v1', false)`, [A]));
  const r = await asUser(A, (tx) => tx.query<{ granted: boolean }>(`select granted from consent_records where purpose = 'ai_processing' order by at desc limit 1`));
  assert.equal(r.rows[0]!.granted, false);
});

test("a set cannot be moved under someone else's workout by update", async () => {
  const [mine, theirs] = await Promise.all([
    asUser(A, async (tx) => (await tx.query<{ id: string }>(`insert into workout_sessions (user_id, status, tz, client_op_id) values ($1, 'completed', 'Asia/Kolkata', gen_random_uuid()) returning id`, [A])).rows[0]!.id),
    asUser(B, async (tx) => (await tx.query<{ id: string }>(`insert into workout_sessions (user_id, status, tz, client_op_id) values ($1, 'completed', 'Asia/Kolkata', gen_random_uuid()) returning id`, [B])).rows[0]!.id),
  ]);
  const set = await asUser(A, async (tx) => (await tx.query<{ id: string }>(`insert into exercise_sets (user_id, session_id, exercise_id, set_index, reps, client_op_id) values ($1, $2, 'bw_squat', 1, 10, gen_random_uuid()) returning id`, [A, mine])).rows[0]!.id);
  await rejects(asUser(A, (tx) => tx.query(`update exercise_sets set session_id = $1 where id = $2`, [theirs, set])), /row-level security/);
});

test('users cannot file a report as closed or a safety event as reviewed', async () => {
  await rejects(asUser(A, (tx) => tx.query(`insert into reports (user_id, kind, text, app_version, status, client_op_id) values ($1, 'bug', 'x', '0.1.0', 'closed', gen_random_uuid())`, [A])), /row-level security/);
  await rejects(asUser(A, (tx) => tx.query(`insert into safety_events (user_id, type, severity, handled_by, reviewer) values ($1, 'pain_report', 'high', 'app', 'me')`, [A])), /row-level security/);
});

test('one row per limit, so limits can be upserted', async () => {
  await asUser(B, (tx) => tx.query(`insert into restrictions (user_id, code, source) values ($1, 'region:knee', 'assessment') on conflict (user_id, code) do update set source = excluded.source`, [B]));
  await asUser(B, (tx) => tx.query(`insert into restrictions (user_id, code, source, expires_at) values ($1, 'region:knee', 'pain_report', '2026-11-01') on conflict (user_id, code) do update set source = excluded.source, expires_at = excluded.expires_at`, [B]));
  const r = await asUser(B, (tx) => tx.query(`select * from restrictions where code = 'region:knee'`));
  assert.equal(r.rows.length, 1);
});

test('signed-out clients can read nothing', async () => {
  await rejects(db.transaction(async (tx) => { await tx.exec('set local role anon'); await tx.query('select * from profiles'); }), /permission denied/);
});

test('a meal can be logged from a photo, and unknown sources are still refused', async () => {
  await asUser(A, (tx) => tx.query(`insert into meal_logs (user_id, eaten_at, day, tz, meal_type, source, client_op_id) values ($1, now(), '2026-10-19', 'Asia/Kolkata', 'dinner', 'photo', gen_random_uuid())`, [A]));
  await rejects(asUser(A, (tx) => tx.query(`insert into meal_logs (user_id, eaten_at, day, tz, meal_type, source, client_op_id) values ($1, now(), '2026-10-19', 'Asia/Kolkata', 'dinner', 'guess', gen_random_uuid())`, [A])), /check constraint/);
});

test('a stale weigh-in edit from another phone cannot overwrite a newer one', async () => {
  const op = '22222222-2222-4222-8222-222222222222';
  const upsert = (value: number, updated: string) =>
    asUser(A, (tx) =>
      tx.query(
        `insert into progress_entries (user_id, metric, value, measured_at, tz, client_op_id, updated_at)
         values ($1, 'weight_kg', $2, '2026-10-19T02:00:00Z', 'Asia/Kolkata', $3, $4)
         on conflict (user_id, client_op_id) do update set value = excluded.value, updated_at = excluded.updated_at`,
        [A, value, op, updated],
      ),
    );
  const read = async () => Number((await asUser(A, (tx) => tx.query<{ value: string }>(`select value from progress_entries where client_op_id = $1`, [op]))).rows[0]!.value);
  await upsert(80, '2026-10-19T10:00:00Z');
  await upsert(79, '2026-10-19T12:00:00Z');
  assert.equal(await read(), 79, 'newer edit applies');
  await upsert(81, '2026-10-19T11:00:00Z');
  assert.equal(await read(), 79, 'older edit is ignored');
});
