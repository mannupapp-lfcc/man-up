-- Ministry chat pushes (0016): off unless he opts in. A message queues the men who
-- opted in, once each; a tag still comes through as a tag; blocks, other ministries,
-- and men who never opted in are not queued; the setting is his own.
begin;
select no_plan();

-- ---------- The setting ----------
select tests.login('a', 'leader');
select lives_ok(format($$insert into notification_settings (ministry_id, profile_id, ministry_chat) values (%L, %L, true)
                         on conflict (ministry_id, profile_id) do update set ministry_chat = true$$,
                       tests.m('a'), tests.u('a', 'leader')), 'he turns ministry chat pushes on');
select throws_ok(format($$insert into notification_settings (ministry_id, profile_id, ministry_chat) values (%L, %L, true)$$,
                        tests.m('a'), tests.u('a', 'colead')), '42501', null, 'he cannot change another man''s setting');
reset role;
-- member2 opts in too, but blocks the author below.
insert into notification_settings (ministry_id, profile_id, ministry_chat) values (tests.m('a'), tests.u('a', 'member2'), true)
  on conflict (ministry_id, profile_id) do update set ministry_chat = true;
insert into user_blocks (ministry_id, blocker_id, blocked_id)
  values (tests.m('a'), tests.u('a', 'member2'), tests.u('a', 'other'));
select is((select ministry_chat from notification_settings where ministry_id = tests.m('a') and profile_id = tests.u('a', 'admin')), null,
  'a man who never chose has no row (and the sender treats that as off)');

-- ---------- Posting ----------
select tests.login('a', 'other');
select lives_ok(format($$select post_ministry_message(%L, 'plain ministry post @member a', array[%L]::uuid[])$$,
                       tests.m('a'), tests.u('a', 'member')), 'a member posts and tags one man');
reset role;

select is(array(select profile_id from push_outbox
                where ref_id = (select id from ministry_messages where body like 'plain ministry post%') order by 1),
  array(select unnest(array[tests.u('a', 'leader'), tests.u('a', 'member')]) order by 1),
  'only the man who opted in and the man who was tagged are queued');
select is((select kind::text from push_outbox where profile_id = tests.u('a', 'member')
           and ref_id = (select id from ministry_messages where body like 'plain ministry post%')), 'ministry_mention',
  'the tagged man is queued as a tag, which he cannot mute');
select is((select kind::text from push_outbox where profile_id = tests.u('a', 'leader')
           and ref_id = (select id from ministry_messages where body like 'plain ministry post%')), 'ministry_message',
  'the man who opted in is queued as an ordinary message');
select is(tests.n($$select 1 from push_outbox where ref_id = (select id from ministry_messages where body like 'plain ministry post%')
                     and (ministry_id <> tests.m('a') or title is not null or body is not null)$$), 0,
  'nothing crosses into ministry B, and no text is stored');

select * from finish();
rollback;
