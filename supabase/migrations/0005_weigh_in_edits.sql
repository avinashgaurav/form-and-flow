-- Form & Flow: when two phones edit the same weigh-in, the newest edit wins (not the last sync).
alter table progress_entries add column updated_at timestamptz not null default now();

create function keep_newest_progress_edit() returns trigger language plpgsql as $$
begin
  -- An edit made earlier than the stored one is stale: skip it, keep the row as it is.
  if new.updated_at < old.updated_at then
    return null;
  end if;
  return new;
end $$;
create trigger progress_entries_newest_wins before update on progress_entries for each row execute function keep_newest_progress_edit();
