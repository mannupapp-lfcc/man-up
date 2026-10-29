-- ============================================================
-- Man Up - Wake the push sender instead of polling (0018_push_wake.sql).
-- Kevin reviews this function before push. No RLS policy changes.
--
-- The push sender used to run every minute (43,200 Inngest runs a month, nearly all
-- finding an empty outbox). Now each insert into push_outbox sends Inngest one
-- "push/outbox.queued" event, and the sender runs only then (debounced, so a burst of
-- messages is one run).
--
--   pg_net                     enabled; the call is queued in the transaction and sent
--                              after commit (a rolled-back insert never wakes anything)
--   fn_wake_push_sender        statement-level: one event per insert statement, none
--                              when an insert queued nothing (on conflict do nothing).
--                              The event is the name only: no ids, no text, no app data.
--   Vault secret               'inngest_event_key' (the INNGEST_EVENT_KEY value). Until
--                              it exists the trigger does nothing and the hourly
--                              scheduler's wake-up still drains the outbox.
--
-- After push, once:
--   select vault.create_secret('<INNGEST_EVENT_KEY>', 'inngest_event_key');
-- ============================================================

create extension if not exists pg_net with schema extensions;

create or replace function fn_wake_push_sender()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_key text;
begin
  if not exists (select 1 from queued) then
    return null;
  end if;
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'inngest_event_key';
  if coalesce(v_key, '') = '' then
    return null;
  end if;
  perform net.http_post(
    url := 'https://inn.gs/e/' || v_key,
    body := jsonb_build_object('name', 'push/outbox.queued', 'data', '{}'::jsonb),
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  return null;
end $$;

create trigger push_outbox_wake_sender after insert on push_outbox
  referencing new table as queued
  for each statement execute function fn_wake_push_sender();

revoke execute on function fn_wake_push_sender() from public, anon, authenticated;
