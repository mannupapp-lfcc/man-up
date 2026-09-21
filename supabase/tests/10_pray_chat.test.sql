-- Pray, chat, reports, and blocks.
begin;
select no_plan();

-- Fixture adds: a ministry-wide request from 'other' (group 2) and a comment on it.
insert into prayer_requests (ministry_id, group_id, profile_id, body, visibility)
  values (tests.m('a'), tests.g('a', 2), tests.u('a', 'other'), 'wide from other', 'ministry');
insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, body)
  select tests.m('a'), id, tests.u('a', 'other_leader'), 'comment', 'praying, brother'
  from prayer_requests where body = 'wide from other';


-- ---------- prayer_wall ----------
select tests.login('a', 'member');
select is((select count(*)::int from prayer_wall(tests.m('a'))), 3,
          'member sees his group''s two requests plus the ministry-wide one');
select is((select author_name from prayer_wall(tests.m('a')) where body = 'anonymous prayer a'), null,
          'an anonymous request shows no author to others');
select is((select author_name from prayer_wall(tests.m('a')) where body = 'wide from other'), 'other a',
          'a named ministry-wide request shows its author, even from another group');
select is((select prayed_count from prayer_wall(tests.m('a')) where body = 'member prayer a'), 1, 'prayed count');
select is((select i_prayed from prayer_wall(tests.m('a')) where body = 'member prayer a'), false,
          'i_prayed is false when he has not prayed');
select is((select count(*)::int from prayer_wall(tests.m('b'))), 0, 'nothing from another ministry');
select is((select author_name from prayer_comments((select id from prayer_wall(tests.m('a')) where body = 'wide from other'))),
          'other_leader a', 'comment author from another group is named');
reset role;

select tests.login('a', 'member2');
select is((select author_name from prayer_wall(tests.m('a')) where body = 'anonymous prayer a'), 'member2 a',
          'the author sees his own name on his anonymous request');
select is((select is_mine from prayer_wall(tests.m('a')) where body = 'anonymous prayer a'), true, 'and is_mine');
select throws_ok(
  format($$insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind)
           select %L, id, %L, 'prayed' from prayer_requests where body = 'member prayer a'$$,
         tests.m('a'), tests.u('a', 'member2')),
  '23505', null, 'one "I prayed" per man per request');
reset role;

select tests.login('a', 'admin');
select is((select count(*)::int from prayer_wall(tests.m('a'))), 1, 'admin sees only the ministry-wide request');
reset role;

-- ---------- Blocks ----------
select tests.login('a', 'member');
select lives_ok(format($$insert into user_blocks (ministry_id, blocker_id, blocked_id) values (%L, %L, %L)$$,
                       tests.m('a'), tests.u('a', 'member'), tests.u('a', 'other')),
                'a man blocks another man in his ministry');
select is((select count(*)::int from prayer_wall(tests.m('a')) where body = 'wide from other'), 0,
          'the blocked man''s request disappears for him');
select throws_ok(format($$insert into user_blocks (ministry_id, blocker_id, blocked_id) values (%L, %L, %L)$$,
                        tests.m('a'), tests.u('a', 'member2'), tests.u('a', 'other')),
                 '42501', null, 'he cannot create a block on someone else''s behalf');
select throws_ok(format($$insert into user_blocks (ministry_id, blocker_id, blocked_id) values (%L, %L, %L)$$,
                        tests.m('a'), tests.u('a', 'member'), tests.u('b', 'member')),
                 '42501', null, 'he cannot block someone outside his ministry');
reset role;

insert into group_messages (ministry_id, group_id, profile_id, body)
  values (tests.m('a'), tests.g('a', 1), tests.u('a', 'member2'), 'from member2');
select tests.login('a', 'member');
select is(tests.n('select 1 from group_messages'), 2, 'member sees his group''s messages');
insert into user_blocks (ministry_id, blocker_id, blocked_id) values (tests.m('a'), tests.u('a', 'member'), tests.u('a', 'member2'));
select is(tests.n($q$select 1 from group_messages where body = 'from member2'$q$), 0,
          'a blocked group mate''s messages disappear for him');
reset role;
select tests.login('a', 'leader');
select is(tests.n($q$select 1 from group_messages where body = 'from member2'$q$), 1,
          'the block does not hide anything from anyone else');
reset role;
select tests.login('a', 'admin');
select is(tests.n('select 1 from user_blocks'), 3, 'admins can see that blocks exist (2 here plus the fixture''s)');
select is(tests.n('select 1 from group_messages'), 0, 'blocks give admins no chat access');
reset role;

-- ---------- Reports and the privacy-wall exception ----------

-- He cannot report what he cannot see (group 1's message, from group 2).
select tests.login('a', 'other');
select throws_ok(
  format($$insert into content_reports (ministry_id, reporter_id, target_type, target_id) values (%L, %L, 'group_message', %L)$$,
         tests.m('a'), tests.u('a', 'other'), (select id from group_messages where body = 'group 1 message a')),
  '42501', null, 'a man cannot report a message he cannot see');
reset role;

select tests.login('a', 'member2');
select lives_ok(
  format($$insert into content_reports (ministry_id, reporter_id, target_type, target_id, reason) values (%L, %L, 'group_message', %L, 'hurtful')$$,
         tests.m('a'), tests.u('a', 'member2'), (select id from group_messages where body = 'group 1 message a')),
  'a group member reports a message');
select is(tests.n($q$select 1 from content_reports where status = 'open'$q$), 1, 'he sees his own open report');
reset role;

select tests.login('a', 'admin');
select is(tests.n($q$select 1 from content_reports where status = 'open'$q$), 1, 'admin sees the open report');
select is(tests.n('select 1 from group_messages'), 1, 'admin now sees exactly the reported message');
select is(tests.n($q$select 1 from group_messages where body = 'group 1 message a'$q$), 1, 'and it is the right one');
select lives_ok(format($$ select resolve_report(%L, false) $$, (select id from content_reports where status = 'open')),
                'admin dismisses the report');
select is(tests.n('select 1 from group_messages'), 0, 'once resolved, admin loses sight of the message');
reset role;

select tests.login('a', 'member2');
select lives_ok(
  format($$insert into content_reports (ministry_id, reporter_id, target_type, target_id) values (%L, %L, 'prayer_request', %L)$$,
         tests.m('a'), tests.u('a', 'member2'), (select id from prayer_requests where body = 'member prayer a')),
  'a man reports a prayer request');
reset role;
select tests.login('a', 'leader');
select throws_ok(format($$ select resolve_report(%L, true) $$, (select id from content_reports where status = 'open')),
                 '42501', null, 'a leader cannot resolve reports');
reset role;
select tests.login('a', 'admin');
select is(tests.n('select 1 from prayer_requests'), 1 + 1,
          'admin sees the reported request (plus the ministry-wide one)');
select throws_ok('select profile_id from prayer_requests', '42501', null,
                 'even for a reported request, the author column stays hidden');
select lives_ok(format($$ select resolve_report(%L, true) $$, (select id from content_reports where status = 'open')),
                'admin removes the reported request');
reset role;
select is((select count(*)::int from prayer_requests where body = 'member prayer a'), 0, 'request removed');
select is((select count(*)::int from prayer_interactions i
           where not exists (select 1 from prayer_requests r where r.id = i.prayer_request_id)), 0,
          'its prayers and comments went with it');
select is((select status::text from content_reports where target_type = 'prayer_request'), 'actioned', 'report marked actioned');

-- ---------- Realtime ----------
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'group_messages'),
          'group chat is in the Realtime publication');

select * from finish();
rollback;
