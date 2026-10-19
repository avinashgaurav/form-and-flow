-- Form & Flow: meals logged from a photo (the AI names foods; the phone's engine counts them).
alter table meal_logs drop constraint meal_logs_source_check;
alter table meal_logs add constraint meal_logs_source_check check (source in ('search','text_parse','saved_meal','recipe','photo'));
