-- Form & Flow: nutrition logs, coach run records, problem reports, privacy (plan/12 sections 3.4 to 3.6, plan/15).
-- Same pattern as 0001: every user-owned table has forced RLS scoped to auth.uid().
-- Coach chat text is NOT stored on the server: it stays on the phone (data minimisation). The server
-- keeps only model run records without content, for rate limits and cost.

-- Nutrition ------------------------------------------------------------------

create table preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  diet_pattern text check (diet_pattern in ('veg','eggetarian','non_veg','vegan','jain')),
  -- Allergens are hard filters and kept apart from dislikes by design (plan/12 3.2).
  allergens text[] not null default '{}',
  allergen_free_text text[] not null default '{}',
  dislikes text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  eaten_at timestamptz not null,
  day date not null,
  tz text not null,
  meal_type text not null check (meal_type in ('breakfast','lunch','snack','dinner')),
  source text not null check (source in ('search','text_parse','saved_meal','recipe')),
  client_op_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_op_id)
);
create index meal_logs_user_day_idx on meal_logs (user_id, day desc);

create table meal_log_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_log_id uuid not null references meal_logs (id) on delete cascade,
  food_id text not null check (char_length(food_id) <= 80),
  name text not null check (char_length(name) <= 120),
  qty numeric not null check (qty > 0 and qty <= 5000),
  unit text not null check (char_length(unit) <= 20),
  grams numeric not null check (grams > 0 and grams <= 5000),
  oil_level text check (oil_level in ('light','normal','rich')),
  -- Values and ranges as computed when logged, so later catalogue edits never rewrite history.
  nutrients_snapshot jsonb not null,
  client_op_id uuid not null,
  unique (user_id, client_op_id)
);

create table saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  items jsonb not null,
  client_op_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_op_id)
);

-- Problem reports (S34, F-22) ---------------------------------------------------

create table reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('wrong_food_data','unsafe_advice','bug','account')),
  text text not null check (char_length(text) between 1 and 2000),
  context jsonb,
  app_version text not null check (char_length(app_version) <= 20),
  status text not null default 'open' check (status in ('open','triaged','closed')),
  client_op_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_op_id)
);

-- Server-only records -------------------------------------------------------------

-- One row per model call. No message content (plan/12 3.5). Used for the coach rate limit and cost.
create table model_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('coach_turn','meal_parse')),
  provider text not null default 'anthropic',
  model text not null,
  prompt_version text not null,
  input_tokens int,
  output_tokens int,
  latency_ms int,
  schema_valid boolean not null,
  stop_reason text,
  created_at timestamptz not null default now()
);
create index model_runs_user_time_idx on model_runs (user_id, created_at desc);

create table privacy_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('export','deletion')),
  status text not null default 'received' check (status in ('received','completed','failed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Security log store (plan/15, DPDP R-05): authentication, access and processing events only,
-- never content. Not linked to auth.users, so it survives account deletion for one year.
create table security_log (
  id uuid primary key default gen_random_uuid(),
  user_ref text not null,
  event text not null check (event in ('model_call','export','deletion','sign_in')),
  detail text check (char_length(detail) <= 200),
  at timestamptz not null default now()
);
create index security_log_at_idx on security_log (at);

-- Row-level security ------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['preferences','meal_logs','meal_log_items','saved_meals','reports','privacy_requests']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('create policy %I on %I for select to authenticated using (user_id = auth.uid())', t || '_select_own', t);
    execute format('create policy %I on %I for insert to authenticated with check (user_id = auth.uid())', t || '_insert_own', t);
    execute format('create policy %I on %I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_update_own', t);
    execute format('create policy %I on %I for delete to authenticated using (user_id = auth.uid())', t || '_delete_own', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- Reports are append-only for the user.
drop policy reports_update_own on reports;
drop policy reports_delete_own on reports;
revoke update, delete on reports from authenticated;

-- Privacy requests are created by the server function; the user can only read their own.
drop policy privacy_requests_insert_own on privacy_requests;
drop policy privacy_requests_update_own on privacy_requests;
drop policy privacy_requests_delete_own on privacy_requests;
revoke insert, update, delete on privacy_requests from authenticated;

-- Meal items must belong to a meal the same user owns.
create policy meal_log_items_meal_owner on meal_log_items as restrictive for insert to authenticated
  with check (exists (select 1 from meal_logs m where m.id = meal_log_id and m.user_id = auth.uid()));

-- Model runs and the security log are service-only.
alter table model_runs enable row level security;
alter table model_runs force row level security;
alter table security_log enable row level security;
alter table security_log force row level security;
revoke all on model_runs, security_log from authenticated, anon;

-- Helpers ------------------------------------------------------------------------

-- Same hash in the deletion ledger and the security log, so neither stores a raw user ID.
create function hash_user_id(uid uuid) returns text language sql immutable as
  $$ select encode(sha256(convert_to(uid::text, 'UTF8')), 'hex') $$;

-- Retention (plan/15): security log 1 year, model runs 90 days, reports 1 year.
-- Schedule daily with pg_cron on the hosted project: select cron.schedule('purge', '15 3 * * *', 'select purge_expired()');
create function purge_expired() returns void language sql security definer set search_path = public as $$
  delete from security_log where at < now() - interval '1 year';
  delete from model_runs where created_at < now() - interval '90 days';
  delete from reports where created_at < now() - interval '1 year';
$$;
revoke execute on function purge_expired() from public, authenticated, anon;
