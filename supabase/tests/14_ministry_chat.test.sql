-- Ministry chat: everyone in the ministry, tags, leader alerts, blocks, reports.
begin;
select no_plan();

-- Fixture: 'other' posted 'ministry message a' tagging 'member', with one alert.

-- ---------- Reading ----------
select tests.login('a', 'member');
select is(tests.n('select 1 from ministry_messages'), 1, 'a member reads the ministry chat, across groups');
reset role;
select tests.login('a', 'unplaced');
select is(tests.n('select 1 from ministry_messages'), 1, 'a man in no group reads it too');
reset role;
select tests.login('a', 'admin');
select is(tests.n('select 1 from ministry_messages'), 1, 'admins are in the room');
reset role;
select tests.login('b', 'member');
select is(tests.n('select 1 from ministry_messages'), 1, 'ministry B sees only its own message');
select is(tests.n($q$select 1 from ministry_messages where body = 'ministry message a'$q$), 0,
          'nothing from ministry A');
reset role;

-- ---------- Posting ----------
select tests.login('a', 'member');
select throws_ok(
  format($$insert into ministry_messages (ministry_id, profile_id, body) values (%L, %L, 'direct')$$,
         tests.m('a'), tests.u('a', 'member')),
  '42501', null, 'no direct insert: posting goes through post_ministry_message');
select throws_ok(format($$select post_ministry_message(%L, 'intruder')$$, tests.m('b')),
                 '42501', null, 'he cannot post in another ministry');
select throws_ok(format($$select post_ministry_message(%L, '   ')$$, tests.m('a')),
                 '22023', null, 'an empty message is refused');
select lives_ok(
  format($$select post_ministry_message(%L, 'hey @member2 a and @leader a', array[%L, %L, %L, %L]::uuid[])$$,
         tests.m('a'), tests.u('a', 'member2'), tests.u('a', 'leader'), tests.u('a', 'member'), tests.u('b', 'member')),
  'a member posts and tags two men');
select is((select profile_id from ministry_messages where body like 'hey @member2%'), tests.u('a', 'member'),
          'the message is his, whatever he passed');
select is((select array_length(mentions, 1) from ministry_messages where body like 'hey @member2%'), 2,
          'tags keep only other current members of this ministry (not himself, not ministry B)');
select throws_ok(format($$update ministry_messages set body = 'edited' where body like 'hey @member2%%'$$),
                 '42501', null, 'messages cannot be edited');
select is(tests.n('select 1 from ministry_message_alerts'), 0, 'members cannot read the alert queue');
reset role;

select is((select array_agg(a.profile_id order by a.profile_id) from ministry_message_alerts a
           join ministry_messages m on m.id = a.message_id where m.body like 'hey @member2%'),
          array[tests.u('a', 'leader'), tests.u('a', 'member2')] ,
          'a member''s post alerts only the men he tagged');
select is((select count(*)::int from ministry_message_alerts a join ministry_messages m on m.id = a.message_id
           where m.body like 'hey @member2%' and a.kind <> 'mention'), 0, 'and they are mention alerts');

-- A leader's @everyone post alerts every current member except himself; a tag stays a mention.
-- 'member2' blocked the leader first, so he gets nothing.
insert into user_blocks (ministry_id, blocker_id, blocked_id)
  values (tests.m('a'), tests.u('a', 'member2'), tests.u('a', 'leader'));
select tests.login('a', 'leader');
select lives_ok(format($$select post_ministry_message(%L, 'Saturday at 8, men. @everyone @member a', array[%L]::uuid[])$$,
                       tests.m('a'), tests.u('a', 'member')),
                'a leader posts');
reset role;
select is((select count(*)::int from ministry_message_alerts a join ministry_messages m on m.id = a.message_id
           where m.body like 'Saturday at 8%'),
          (select count(*)::int from ministry_members where ministry_id = tests.m('a') and left_at is null) - 2,
          'a leader''s post alerts every current member but him and the man who blocked him');
select is((select kind::text from ministry_message_alerts a join ministry_messages m on m.id = a.message_id
           where m.body like 'Saturday at 8%' and a.profile_id = tests.u('a', 'member')), 'mention',
          'the tagged man gets one alert, as a mention');
select is((select count(*)::int from ministry_message_alerts a join ministry_messages m on m.id = a.message_id
           where m.body like 'Saturday at 8%' and a.profile_id = tests.u('b', 'member')), 0,
          'no alert crosses into ministry B');

-- ---------- Blocks ----------
select tests.login('a', 'member2');
select is(tests.n($q$select 1 from ministry_messages where body like 'Saturday at 8%'$q$), 0,
          'a blocked man''s messages disappear for the man who blocked him');
reset role;
select tests.login('a', 'member');
select is(tests.n($q$select 1 from ministry_messages where body like 'Saturday at 8%'$q$), 1,
          'and for no one else');
reset role;

-- ---------- Names ----------
select tests.login('a', 'member');
select is((select count(*)::int from ministry_people(tests.m('a'))), 9, 'every current member of his ministry, by name');
select is((select is_leader from ministry_people(tests.m('a')) where full_name = 'colead a'), true, 'leaders are marked');
select is((select count(*)::int from ministry_people(tests.m('b'))), 0, 'no names from another ministry');
reset role;

-- ---------- Deleting ----------
select tests.login('a', 'other');
delete from ministry_messages where body like 'hey @member2%';
reset role;
select is((select count(*)::int from ministry_messages where body like 'hey @member2%'), 1,
          'he cannot delete another man''s message');
select tests.login('a', 'member');
select lives_ok($$delete from ministry_messages where body like 'hey @member2%'$$, 'he deletes his own message');
reset role;
select is((select count(*)::int from ministry_message_alerts a
           where not exists (select 1 from ministry_messages m where m.id = a.message_id)), 0,
          'its alerts went with it, so a deleted message is never pushed');

-- ---------- Reports ----------
select tests.login('b', 'member');
select throws_ok(
  format($$insert into content_reports (ministry_id, reporter_id, target_type, target_id) values (%L, %L, 'ministry_message', %L)$$,
         tests.m('b'), tests.u('b', 'member'), (select id from ministry_messages where body = 'ministry message a')),
  '42501', null, 'a man cannot report a message from another ministry');
reset role;
select tests.login('a', 'member');
select lives_ok(
  format($$insert into content_reports (ministry_id, reporter_id, target_type, target_id) values (%L, %L, 'ministry_message', %L)$$,
         tests.m('a'), tests.u('a', 'member'), (select id from ministry_messages where body = 'ministry message a')),
  'a member reports a ministry chat message');
reset role;
select tests.login('a', 'admin');
select lives_ok(format($$ select resolve_report(%L, true) $$,
                       (select id from content_reports where status = 'open' and target_type = 'ministry_message')),
                'admin removes it');
reset role;
select is((select count(*)::int from ministry_messages where body = 'ministry message a'), 0, 'message removed');

-- ---------- Existing report types still work after the enum rebuild ----------
select is((select count(*)::int from content_reports where target_type = 'group_message' and ministry_id = tests.m('a')), 1,
          'fixture group chat reports survived the type change');

-- ---------- Realtime ----------
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'ministry_messages'),
          'ministry chat is in the Realtime publication');

select * from finish();
rollback;
