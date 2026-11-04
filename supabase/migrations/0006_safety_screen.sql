-- AI safety screen (second layer after the phone's safety word list). Its calls are logged like any
-- other model call, with their own purpose so they have their own hourly limit (functions/_shared/run.ts).
-- Only the purpose, model, token counts and outcome are stored, never the message.
alter table model_runs drop constraint model_runs_purpose_check;
alter table model_runs add constraint model_runs_purpose_check check (purpose in ('coach_turn','meal_parse','safety_screen'));
