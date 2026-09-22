-- Weekly check-in and push (0014): check-ins are visible to his current group only,
-- never to admins outside it; the outbox and other men's settings are closed to
-- clients; the chat triggers queue the right men.
begin;
select no_plan();

-- ---------- Check-in visibility ----------
select tests.login('a', 'member2');
select is(tests.n($$select 1 from weekly_checkins where note like 'member checkin%'$$), 1,
  'a man in the same group reads his check-in');
reset role;
select tests.login('a', 'leader');
select is(tests.n($$select 1 from weekly_checkins where note like 'member checkin%'$$), 1,
  'his group leader reads it as a member of the group');
reset role;
select tests.login('a', 'other');
select is(tests.n($$select 1 from weekly_checkins$$), 0, 'a man in another group reads none');
reset role;
select tests.login('a', 'admin');
select is(tests.n($$select 1 from weekly_checkins$$), 0, 'an admin outside the group reads none (privacy wall)');
reset role;
select tests.login('a', 'former');
select is(tests.n($$select 1 from weekly_checkins$$), 0, 'a man who left the group reads none');
reset role;
select tests.login('a', 'unplaced');
select is(tests.n($$select 1 from weekly_checkins$$), 0, 'a man in no group reads none');
reset role;

-- Blocked: member2 blocks member and no longer sees his check-in.
insert into user_blocks (ministry_id, blocker_id, blocked_id) values (tests.m('a'), tests.u('a', 'member2'), tests.u('a', 'member'));
select tests.login('a', 'member2');
select is(tests.n($$select 1 from weekly_checkins where note like 'member checkin%'$$), 0,
  'a man who blocked him does not see his check-in');
reset role;

-- ---------- Writing ----------
select tests.login('a', 'member2');
select throws_ok($$insert into weekly_checkins (ministry_id, group_id, profile_id, week_of, scale)
                   values (tests.m('a'), tests.g('a', 1), tests.u('a', 'member2'), current_date, 3)$$,
  '42501', null, 'no direct insert: check-ins go through submit_checkin');
select lives_ok(format($$select submit_checkin(%L, 4, '  rough week  ')$$, tests.m('a')), 'he checks in');
select lives_ok(format($$select submit_checkin(%L, 5)$$, tests.m('a')), 'he changes his answer the same week');
select is(tests.n($$select 1 from weekly_checkins where profile_id = tests.u('a', 'member2')$$), 1, 'still one check-in this week');
select is((select scale from weekly_checkins where profile_id = tests.u('a', 'member2'))::int, 5, 'the new answer is kept');
select is((select group_id from weekly_checkins where profile_id = tests.u('a', 'member2')), tests.g('a', 1), 'saved to his own group');
select throws_ok(format($$select submit_checkin(%L, 6)$$, tests.m('a')), '22023', null, 'scale is 1 to 5');
select throws_ok(format($$select submit_checkin(%L, 3)$$, tests.m('b')), '42501', null, 'cannot check in to another ministry');
reset role;
select tests.login('a', 'unplaced');
select throws_ok(format($$select submit_checkin(%L, 3)$$, tests.m('a')), '42501', null, 'a man in no group cannot check in');
reset role;

-- ---------- Outbox and settings are closed ----------
select tests.login('a', 'member');
select is(tests.n($$select 1 from push_outbox$$), 0, 'members read nothing in the push outbox');
select throws_ok(format($$insert into push_outbox (ministry_id, profile_id, kind, dedupe_key) values (%L, %L, 'checkin_prompt', 'x')$$,
                       tests.m('a'), tests.u('a', 'member')), '42501', null, 'members cannot queue pushes');
select is(tests.n($$select 1 from notification_settings$$), 1, 'he reads his own settings');
select lives_ok(format($$insert into notification_settings (ministry_id, profile_id, meeting_reminders)
                         values (%L, %L, false)
                         on conflict (ministry_id, profile_id) do update set meeting_reminders = false$$,
                       tests.m('a'), tests.u('a', 'member')), 'he changes his own settings');
select throws_ok(format($$insert into notification_settings (ministry_id, profile_id) values (%L, %L)$$,
                       tests.m('a'), tests.u('a', 'member2')), '42501', null, 'he cannot write another man''s settings');
reset role;
select tests.login('a', 'admin');
select is(tests.n($$select 1 from push_outbox$$), 0, 'admins read nothing in the push outbox');
select is(tests.n($$select 1 from notification_settings$$), 0, 'admins cannot read other men''s settings');
reset role;

-- ---------- Push tokens ----------
select tests.login('a', 'member2');
select lives_ok(format($$select register_push_token(%L, 'ExponentPushToken[a]')$$, tests.m('a')),
  'a man registers the token of a phone someone else used');
reset role;
select is((select array_agg(profile_id) from push_tokens where expo_token = 'ExponentPushToken[a]'),
  array[tests.u('a', 'member2')], 'the phone now belongs to him alone');
select tests.login('a', 'member2');
select throws_ok(format($$select register_push_token(%L, 'not a token')$$, tests.m('a')), '22023', null, 'only Expo tokens');
select throws_ok(format($$select register_push_token(%L, 'ExponentPushToken[x]')$$, tests.m('b')), '42501', null,
  'cannot register in another ministry');
reset role;

-- ---------- Triggers ----------
select is(
  array(select profile_id from push_outbox where kind = 'group_message' and ministry_id = tests.m('a')
          and ref_id = (select id from group_messages where body = 'group 1 message a') order by 1),
  array[tests.u('a', 'leader'), tests.u('a', 'colead'), tests.u('a', 'member2')],
  'a group message queues every current group member except the author and former members');
select is(tests.n($$select 1 from push_outbox where kind = 'group_message' and ministry_id = tests.m('a')
                     and ref_id = (select id from group_messages where body = 'group 1 message a')
                     and (title is not null or body is not null)$$), 0,
  'chat pushes store no text in the outbox');

-- member2 blocked member above: member's next message does not queue member2.
insert into group_messages (ministry_id, group_id, profile_id, body) values (tests.m('a'), tests.g('a', 1), tests.u('a', 'member'), 'after the block');
select is(tests.n($$select 1 from push_outbox where kind = 'group_message' and profile_id = tests.u('a', 'member2')
                     and ref_id = (select id from group_messages where body = 'after the block')$$), 0,
  'a man who blocked the author is not pushed');

select is(tests.n($$select 1 from push_outbox where kind = 'ministry_mention' and profile_id = tests.u('a', 'member')
                     and ministry_id = tests.m('a')$$), 1,
  'a ministry chat tag is copied into the outbox');
select is(tests.n($$select 1 from push_outbox where ministry_id = tests.m('a')
                     and profile_id in (select profile_id from ministry_members where ministry_id = tests.m('b'))$$), 0,
  'the outbox never queues a man from another ministry');

select * from finish();
rollback;
