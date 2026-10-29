-- Push wake-up (0018): an insert into push_outbox queues one Inngest event per
-- statement, carrying the event name only; an insert that queues nothing, or a
-- database without the Vault key, sends nothing; signed-in users cannot call it.
-- pg_net only sends after commit, and the runner rolls back, so nothing leaves.
begin;
select no_plan();

create temp table wake_base on commit drop as select coalesce(max(id), 0) as id from net.http_request_queue;
create function pg_temp.wakes() returns bigint language sql as
  $$ select count(*) from net.http_request_queue where id > (select id from wake_base) and url like 'https://inn.gs/e/%' $$;

-- ---------- No key: nothing is sent ----------
delete from vault.secrets where name = 'inngest_event_key';
insert into push_outbox (ministry_id, profile_id, kind, dedupe_key)
  values (tests.m('a'), tests.u('a', 'member'), 'checkin_prompt', 'wake-test:no-key');
select is(pg_temp.wakes(), 0::bigint, 'without the Vault key the insert works and wakes nothing');

-- ---------- With the key ----------
select vault.create_secret('test-event-key', 'inngest_event_key');

insert into push_outbox (ministry_id, profile_id, kind, dedupe_key)
  values (tests.m('a'), tests.u('a', 'member'), 'checkin_prompt', 'wake-test:one'),
         (tests.m('a'), tests.u('a', 'leader'), 'checkin_prompt', 'wake-test:one'),
         (tests.m('b'), tests.u('b', 'member'), 'checkin_prompt', 'wake-test:one');
select is(pg_temp.wakes(), 1::bigint, 'one insert of three rows sends one event');

select is((select url from net.http_request_queue where id > (select id from wake_base) order by id desc limit 1),
  'https://inn.gs/e/test-event-key', 'the event goes to Inngest with the Vault key');
select is((select convert_from(body, 'utf8')::jsonb from net.http_request_queue where id > (select id from wake_base) order by id desc limit 1),
  '{"name": "push/outbox.queued", "data": {}}'::jsonb, 'the event is the name only: no ids, no text');

insert into push_outbox (ministry_id, profile_id, kind, dedupe_key)
  values (tests.m('a'), tests.u('a', 'member'), 'checkin_prompt', 'wake-test:one')
  on conflict (profile_id, dedupe_key) do nothing;
select is(pg_temp.wakes(), 1::bigint, 'an insert that queues nothing (already queued) sends nothing');

-- A chat message queues through the 0014 trigger and wakes the sender too.
insert into group_messages (ministry_id, group_id, profile_id, body)
  select ministry_id, group_id, profile_id, 'wake test message'
  from group_members where ministry_id = tests.m('a') and profile_id = tests.u('a', 'member') and left_at is null;
select is(pg_temp.wakes(), 2::bigint, 'a group chat message wakes the sender once, however many men it queues');

-- ---------- Signed-in users cannot call it ----------
select is(has_function_privilege('authenticated', 'fn_wake_push_sender()', 'execute'), false,
  'signed-in users cannot execute the wake function');
select is(has_function_privilege('anon', 'fn_wake_push_sender()', 'execute'), false,
  'anonymous users cannot execute the wake function');

select * from finish();
rollback;
