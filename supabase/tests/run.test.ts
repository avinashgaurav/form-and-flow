/**
 * Tests for the checks every AI call passes first (functions/_shared/run.ts): consent from the
 * user's own records, an hourly call limit and a daily token cap. Supabase is replaced by a small
 * in-memory fake that implements only the query calls run.ts makes.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { CALLS_PER_HOUR, startRun, TOKENS_PER_DAY } from '../functions/_shared/run.ts';

type Row = Record<string, unknown>;

class FakeDb {
  tables: Record<string, Row[]> = { consent_records: [], model_runs: [], security_log: [] };
  /** `table:operation` pairs that return an error, to test failure paths. */
  failing = new Set<string>();
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null; count?: number }> {
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: Row | Row[] | undefined;
  private filters: ((r: Row) => boolean)[] = [];
  private returning = false;
  private head = false;
  private one: 'single' | 'maybe' | null = null;
  private sort: { key: string; asc: boolean } | null = null;
  private max: number | null = null;
  constructor(private db: FakeDb, private table: string) {}
  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === 'insert') this.returning = true;
    else this.head = !!opts?.head;
    return this;
  }
  insert(p: Row | Row[]) { this.op = 'insert'; this.payload = p; return this; }
  update(p: Row) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(k: string, v: unknown) { this.filters.push((r) => r[k] === v); return this; }
  neq(k: string, v: unknown) { this.filters.push((r) => r[k] !== v); return this; }
  gte(k: string, v: string) { this.filters.push((r) => String(r[k]) >= v); return this; }
  order(key: string, o?: { ascending?: boolean }) { this.sort = { key, asc: o?.ascending !== false }; return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  then<A, B>(ok?: ((v: { data: unknown; error: { message: string } | null; count?: number }) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, bad);
  }
  private run() {
    if (this.db.failing.has(`${this.table}:${this.op}`)) return { data: null, error: { message: 'boom' } };
    const rows = (this.db.tables[this.table] ??= []);
    const match = (r: Row) => this.filters.every((f) => f(r));
    if (this.op === 'insert') {
      const added = ([] as Row[]).concat(this.payload as Row | Row[]).map((r) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...r }));
      rows.push(...added);
      return { data: this.returning ? (this.one ? added[0] : added) : null, error: null };
    }
    if (this.op === 'update') {
      for (const r of rows.filter(match)) Object.assign(r, this.payload);
      return { data: null, error: null };
    }
    if (this.op === 'delete') {
      this.db.tables[this.table] = rows.filter((r) => !match(r));
      return { data: null, error: null };
    }
    let found = rows.filter(match);
    if (this.sort) {
      const { key, asc } = this.sort;
      found = [...found].sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : 1) * (asc ? 1 : -1));
    }
    if (this.max !== null) found = found.slice(0, this.max);
    if (this.head) return { data: null, error: null, count: found.length };
    if (this.one) return { data: found[0] ?? null, error: null };
    return { data: found, error: null };
  }
}

const client = (db: FakeDb) => ({ from: (t: string) => new Query(db, t) }) as unknown as SupabaseClient;
const USER = { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' } as User;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

function setup(consent: boolean | null = true) {
  const db = new FakeDb();
  if (consent !== null) db.tables.consent_records!.push({ purpose: 'ai_processing', granted: consent, at: ago(60_000) });
  // The user's client sees only their consent (RLS); the admin client sees everything.
  const ctx = { user: USER, userClient: client(db), admin: client(db), traceId: 't' };
  return { db, ctx };
}

async function code(r: unknown) {
  assert.ok(r instanceof Response, 'expected an error response');
  return ((await r.json()) as { error: { code: string } }).error.code;
}

test('no AI consent on record means no model call', async () => {
  const { db, ctx } = setup(null);
  assert.equal(await code(await startRun(ctx, 'coach_turn', 'claude-sonnet-5-5', 'v')), 'FORBIDDEN');
  assert.equal(db.tables.model_runs!.length, 0);
});

test('the latest consent decides: a withdrawal after a grant blocks the call', async () => {
  const { db, ctx } = setup(true);
  db.tables.consent_records!.push({ purpose: 'ai_processing', granted: false, at: ago(1_000) });
  assert.equal(await code(await startRun(ctx, 'meal_parse', 'claude-sonnet-5-5', 'v')), 'FORBIDDEN');
});

test('with consent and room under the limits, a run is reserved before the call', async () => {
  const { db, ctx } = setup();
  const run = await startRun(ctx, 'meal_parse', 'claude-haiku-5-5', 'photo-v');
  assert.ok(!(run instanceof Response));
  assert.equal(run.model, 'claude-haiku-5-5');
  assert.deepEqual(
    db.tables.model_runs!.map((r) => [r.purpose, r.model, r.stop_reason]),
    [['meal_parse', 'claude-haiku-5-5', 'pending']],
  );
});

test(`call ${CALLS_PER_HOUR + 1} in an hour is refused and leaves no row behind`, async () => {
  const { db, ctx } = setup();
  for (let i = 0; i < CALLS_PER_HOUR; i++) db.tables.model_runs!.push({ user_id: USER.id, created_at: ago(10 * 60_000), stop_reason: 'end_turn', input_tokens: 10, output_tokens: 10 });
  assert.equal(await code(await startRun(ctx, 'coach_turn', 'm', 'v')), 'RATE_LIMITED');
  assert.equal(db.tables.model_runs!.length, CALLS_PER_HOUR);
});

test('calls older than an hour, and refused ones, do not count', async () => {
  const { db, ctx } = setup();
  for (let i = 0; i < CALLS_PER_HOUR; i++) db.tables.model_runs!.push({ user_id: USER.id, created_at: ago(2 * 3_600_000), stop_reason: 'end_turn' });
  for (let i = 0; i < 5; i++) db.tables.model_runs!.push({ user_id: USER.id, created_at: ago(60_000), stop_reason: 'rate_limited' });
  assert.ok(!((await startRun(ctx, 'coach_turn', 'm', 'v')) instanceof Response));
});

test('the coach and photos share one limit', async () => {
  const { db, ctx } = setup();
  for (let i = 0; i < CALLS_PER_HOUR; i++) db.tables.model_runs!.push({ user_id: USER.id, purpose: i % 2 ? 'coach_turn' : 'meal_parse', created_at: ago(60_000), stop_reason: 'end_turn' });
  assert.equal(await code(await startRun(ctx, 'meal_parse', 'm', 'v')), 'RATE_LIMITED');
});

test('the daily token cap refuses further calls', async () => {
  const { db, ctx } = setup();
  db.tables.model_runs!.push({ user_id: USER.id, created_at: ago(5 * 3_600_000), stop_reason: 'end_turn', input_tokens: TOKENS_PER_DAY, output_tokens: 1 });
  assert.equal(await code(await startRun(ctx, 'coach_turn', 'm', 'v')), 'RATE_LIMITED');
});

test('another user’s calls never count against this user', async () => {
  const { db, ctx } = setup();
  for (let i = 0; i < CALLS_PER_HOUR * 2; i++) db.tables.model_runs!.push({ user_id: 'someone-else', created_at: ago(60_000), stop_reason: 'end_turn' });
  assert.ok(!((await startRun(ctx, 'coach_turn', 'm', 'v')) instanceof Response));
});

test('finishing a run records usage and a security log entry without the raw user ID', async () => {
  const { db, ctx } = setup();
  const run = await startRun(ctx, 'coach_turn', 'm', 'v');
  assert.ok(!(run instanceof Response));
  await run.done({ schema_valid: true, stop_reason: 'end_turn', input_tokens: 1200, output_tokens: 90 });
  const r = db.tables.model_runs![0]!;
  assert.equal(r.stop_reason, 'end_turn');
  assert.equal(r.output_tokens, 90);
  assert.equal(typeof r.latency_ms, 'number');
  const log = db.tables.security_log!;
  assert.equal(log.length, 1);
  assert.equal(log[0]!.event, 'model_call');
  assert.ok(!JSON.stringify(log).includes(USER.id));
});

test('database errors fail closed', async () => {
  const consentDown = setup();
  consentDown.db.failing.add('consent_records:select');
  assert.equal(await code(await startRun(consentDown.ctx, 'coach_turn', 'm', 'v')), 'INTERNAL_ERROR');
  const reserveDown = setup();
  reserveDown.db.failing.add('model_runs:insert');
  assert.equal(await code(await startRun(reserveDown.ctx, 'coach_turn', 'm', 'v')), 'INTERNAL_ERROR');
  const countDown = setup();
  countDown.db.failing.add('model_runs:select');
  assert.equal(await code(await startRun(countDown.ctx, 'coach_turn', 'm', 'v')), 'INTERNAL_ERROR');
});

test(`call ${CALLS_PER_HOUR} in an hour is still allowed`, async () => {
  const { db, ctx } = setup();
  for (let i = 0; i < CALLS_PER_HOUR - 1; i++) db.tables.model_runs!.push({ user_id: USER.id, created_at: ago(10 * 60_000), stop_reason: 'end_turn' });
  assert.ok(!((await startRun(ctx, 'coach_turn', 'm', 'v')) instanceof Response));
});
