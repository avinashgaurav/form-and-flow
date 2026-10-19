-- Form & Flow: hardening after the first independent review (2026-10-19).

-- Consent time is stamped by the database, never the phone, so a grant cannot be back- or
-- future-dated to outrank a later withdrawal. The phone's own time is kept for reference.
alter table consent_records add column client_at timestamptz;
alter table consent_records add column client_op_id uuid;
alter table consent_records add constraint consent_records_op_unique unique (user_id, client_op_id);
create function stamp_consent_time() returns trigger language plpgsql as $$
begin
  new.at := clock_timestamp();
  return new;
end $$;
create trigger consent_records_stamp before insert on consent_records for each row execute function stamp_consent_time();

-- Retried pushes never duplicate safety answers.
alter table readiness_assessments add column client_op_id uuid;
alter table readiness_assessments add constraint readiness_op_unique unique (user_id, client_op_id);
alter table readiness_assessments add constraint readiness_answers_size check (pg_column_size(answers) <= 16384);

-- One row per limit, so the phone can upsert limits instead of deleting them all first.
alter table restrictions add constraint restrictions_one_per_code unique (user_id, code);

-- Ownership must hold on update too, not only on insert: a set or meal item cannot be moved
-- under another user's workout or meal.
create policy exercise_sets_session_owner_update on exercise_sets as restrictive for update to authenticated
  using (true)
  with check (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy meal_log_items_meal_owner_update on meal_log_items as restrictive for update to authenticated
  using (true)
  with check (exists (select 1 from meal_logs m where m.id = meal_log_id and m.user_id = auth.uid()));
create policy plan_changes_plan_owner on plan_changes as restrictive for all to authenticated
  using (true)
  with check (exists (select 1 from plans p where p.id = plan_id and p.user_id = auth.uid()));

-- Users cannot mark their own reports or safety events as handled.
create policy reports_insert_open on reports as restrictive for insert to authenticated with check (status = 'open');
create policy safety_events_insert_unreviewed on safety_events as restrictive for insert to authenticated
  with check (reviewed_at is null and reviewer is null);

-- Bounded JSON sizes.
alter table meal_log_items add constraint meal_items_snapshot_size check (pg_column_size(nutrients_snapshot) <= 16384);
alter table saved_meals add constraint saved_meals_items_size check (pg_column_size(items) <= 65536);
alter table reports add constraint reports_context_size check (context is null or pg_column_size(context) <= 8192);
alter table plans add constraint plans_body_size check (pg_column_size(body) <= 262144);

create index meal_log_items_meal_idx on meal_log_items (meal_log_id);

-- Signed-out clients get nothing.
revoke all on all tables in schema public from anon;
