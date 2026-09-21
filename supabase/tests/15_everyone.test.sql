begin;
select no_plan();
select tests.login('a', 'member');
select throws_ok(format($$select post_ministry_message(%L, '@everyone hello')$$, tests.m('a')),
  '42501', 'Only admins and leaders can use @everyone.', 'members cannot broadcast');
select throws_ok(format($$select post_ministry_message(%L, 'Hello (@EVERYONE)!')$$, tests.m('a')),
  '42501', null, 'case and punctuation cannot bypass authorization');
select lives_ok(format($$select post_ministry_message(%L, 'test@everyone.example and @everyoneelse')$$, tests.m('a')),
  'embedded and longer names are not broadcast tags');
reset role;
insert into user_blocks(ministry_id, blocker_id, blocked_id)
values (tests.m('a'), tests.u('a', 'member2'), tests.u('a', 'leader'));
select tests.login('a', 'leader');
select lives_ok(format($$select post_ministry_message(%L, '@everyone test broadcast', array[%L]::uuid[])$$,
  tests.m('a'), tests.u('a', 'member')), 'leader can broadcast and tag an individual');
reset role;
select is((select count(*)::int from ministry_message_alerts a join ministry_messages m on m.id=a.message_id
  where m.body='@everyone test broadcast'),
  (select count(*)::int from ministry_members where ministry_id=tests.m('a') and left_at is null)-2,
  'broadcast queues once per current recipient except sender and blocker');
select is((select count(*)::int from ministry_message_alerts a join ministry_messages m on m.id=a.message_id
  where m.body='@everyone test broadcast' and a.profile_id=tests.u('a','member')), 1,
  'individual mention does not duplicate broadcast');
select tests.login('a', 'admin');
select lives_ok(format($$select post_ministry_message(%L, '@everyone admin broadcast')$$, tests.m('a')), 'admin can broadcast');
reset role;
select tests.login('a', 'colead');
select lives_ok(format($$select post_ministry_message(%L, '@everyone coleader broadcast')$$, tests.m('a')), 'co-leaders follow existing leader permissions');
reset role;
-- Without @everyone, neither a leader nor an admin broadcasts.
select tests.login('a', 'leader');
select lives_ok(format($$select post_ministry_message(%L, 'ordinary leader post')$$, tests.m('a')), 'leader posts without a broadcast');
select lives_ok(format($$select post_ministry_message(%L, 'leader individual tag', array[%L]::uuid[])$$,
  tests.m('a'), tests.u('a','member')), 'leader tags one member');
reset role;
select tests.login('a', 'admin');
select lives_ok(format($$select post_ministry_message(%L, 'ordinary admin post')$$, tests.m('a')), 'admin posts without a broadcast');
reset role;
select is((select count(*)::int from ministry_message_alerts a join ministry_messages m on m.id=a.message_id
  where m.body in ('ordinary leader post', 'ordinary admin post')), 0, 'ordinary leader and admin posts queue no alerts');
select is((select count(*)::int from ministry_message_alerts a join ministry_messages m on m.id=a.message_id
  where m.body='leader individual tag'), 1, 'leader individual tag queues only one alert');
select is((select a.profile_id from ministry_message_alerts a join ministry_messages m on m.id=a.message_id
  where m.body='leader individual tag'), tests.u('a','member'), 'only the tagged member receives the alert');

select * from finish();
rollback;
