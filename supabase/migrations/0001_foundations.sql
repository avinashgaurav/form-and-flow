-- Form & Flow: foundations and training loop (plan/12).
-- Every user-owned table has row-level security on and a policy scoped to auth.uid().
-- Restricted tables (readiness, safety) are readable by the owner only; analytics roles get nothing.

-- Enums --------------------------------------------------------------------

create type goal_type as enum ('fat_loss','muscle_gain','strength','fitness','mobility','habits','maintenance');
create type consent_purpose as enum ('core','ai_processing','analytics','crash_reports','reminders','history_personalisation','parse_improvement','human_review_sample');
create type disposition as enum ('clear','limited','excluded','red_flag');
create type restriction_source as enum ('assessment','pain_report','user');
create type safety_event_type as enum ('red_flag_symptom','crisis','pain_report','ed_signal','unsafe_request');
create type plan_status as enum ('proposed','active','superseded','archived');
create type session_status as enum ('planned','in_progress','completed','partial','skipped');
create type set_status as enum ('done','skipped');
create type session_feel as enum ('too_easy','right','too_hard');

-- Identity, consent, safety -------------------------------------------------

create table profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  -- The 18+ check happens at signup (S03); the column only guards against nonsense values.
  birth_year int not null check (birth_year between 1900 and 2100),
  timezone text not null default 'Asia/Kolkata',
  locale text not null default 'en-IN',
  units text not null default 'metric' check (units in ('metric','imperial')),
  nutrition_mode text not null default 'numeric' check (nutrition_mode in ('numeric','non_numeric')),
  coach_tone text not null default 'gentle' check (coach_tone in ('direct','gentle','data')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose consent_purpose not null,
  notice_version text not null,
  granted boolean not null,
  at timestamptz not null default now(),
  channel text not null default 'app'
);
create index consent_records_user_idx on consent_records (user_id, purpose, at desc);

create table readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  questionnaire_version text not null,
  answers jsonb not null,
  disposition disposition not null,
  created_at timestamptz not null default now()
);

create table restrictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  code text not null check (code ~ '^(red_flag|pregnancy|clearance_required|intensity_cap_moderate|no_deficit|no_high_protein|no_fasted_training|non_numeric_only|region:[a-z_]+)$'),
  source restriction_source not null,
  expires_at date,
  created_at timestamptz not null default now()
);
create index restrictions_user_idx on restrictions (user_id);

create table safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type safety_event_type not null,
  severity text not null check (severity in ('critical','high','medium','low')),
  handled_by text not null,
  context_ref text,
  reviewed_at timestamptz,
  reviewer text,
  created_at timestamptz not null default now()
);

-- Kept outside user data so a restored backup never brings a deleted account back (plan/11 section 7).
create table deletion_ledger (
  user_id_hash text primary key,
  deleted_at timestamptz not null default now()
);

-- Plans --------------------------------------------------------------------

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type goal_type not null,
  priority text not null check (priority in ('primary','secondary')),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);
create unique index goals_one_primary on goals (user_id) where priority = 'primary' and status = 'active';

create table plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  version int not null check (version >= 1),
  status plan_status not null default 'proposed',
  week_start date not null,
  engine_version text not null,
  rule_set_version text not null,
  body jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, version)
);
create unique index plans_one_active on plans (user_id) where status = 'active';

create table plan_changes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  rule_ids text[] not null,
  reason_text text not null,
  proposed_by text not null check (proposed_by in ('engine','coach','user')),
  decision text check (decision in ('accepted','declined','expired')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- Training -----------------------------------------------------------------

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_session_key text,
  status session_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  tz text not null,
  feel session_feel,
  note text check (char_length(note) <= 500),
  client_op_id uuid not null,
  unique (user_id, client_op_id)
);
create unique index workout_sessions_one_in_progress on workout_sessions (user_id) where status = 'in_progress';

create table exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references workout_sessions (id) on delete cascade,
  exercise_id text not null,
  set_index int not null check (set_index between 1 and 20),
  reps int check (reps between 0 and 100),
  load_kg numeric(5,1) check (load_kg between 0 and 500),
  duration_s int check (duration_s between 1 and 7200),
  effort_rir int check (effort_rir between 0 and 10),
  status set_status not null default 'done',
  logged_at timestamptz not null default now(),
  client_op_id uuid not null,
  unique (user_id, client_op_id),
  unique (session_id, exercise_id, set_index)
);
create index exercise_sets_user_idx on exercise_sets (user_id, exercise_id, logged_at desc);

create table check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  energy int check (energy between 1 and 5),
  minutes_available int check (minutes_available between 0 and 240),
  pain boolean not null default false,
  client_op_id uuid not null,
  unique (user_id, day),
  unique (user_id, client_op_id)
);

create table progress_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric text not null check (metric in ('weight_kg','waist_cm','sleep_quality','energy')),
  value numeric not null,
  measured_at timestamptz not null,
  tz text not null,
  source text not null default 'manual' check (source in ('manual','health_connect','healthkit')),
  client_op_id uuid not null,
  unique (user_id, client_op_id),
  check (metric <> 'weight_kg' or value between 30 and 250)
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor uuid,
  actor_role text not null,
  action text not null,
  target_table text not null,
  target_id text,
  reason text,
  at timestamptz not null default now()
);

-- Row-level security ---------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['profiles','consent_records','readiness_assessments','restrictions','safety_events',
                           'goals','plans','plan_changes','workout_sessions','exercise_sets','check_ins','progress_entries']
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

-- Consent records and safety events are append-only for the user: no update or delete.
drop policy consent_records_update_own on consent_records;
drop policy consent_records_delete_own on consent_records;
drop policy safety_events_update_own on safety_events;
drop policy safety_events_delete_own on safety_events;
revoke update, delete on consent_records, safety_events from authenticated;

-- Ledger and audit are service-only.
alter table deletion_ledger enable row level security;
alter table audit_events enable row level security;
revoke all on deletion_ledger, audit_events from authenticated, anon;

-- Exercise sets must belong to a session the same user owns.
create policy exercise_sets_session_owner on exercise_sets as restrictive for insert to authenticated
  with check (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
