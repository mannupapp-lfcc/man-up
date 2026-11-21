-- Overseers (0020): a ministry admin flagged is_overseer reads every group's chat,
-- group prayer, check-ins, contact logs (no notes), questions, and tiers in his own
-- ministry, and nothing in another. He never writes into a group, never sees
-- reflections or anonymous authors. Another admin must grant the flag.
begin;
select no_plan();

-- Setup as superuser (auth.uid() is null, so the flag can be set directly).
update ministry_members set is_overseer = true
where ministry_id = tests.m('a') and profile_id = tests.u('a', 'admin');
insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, body)
select tests.m('a'), id, tests.u('a', 'member2'), 'comment', 'comment on member prayer'
from prayer_requests where ministry_id = tests.m('a') and body = 'member prayer a';
-- A second admin in ministry b to test granting.
update ministry_members set role = 'admin'
where ministry_id = tests.m('b') and profile_id = tests.u('b', 'unplaced');

create table tests.ids as
  select (select id from prayer_requests where body = 'member prayer a') as pr1,
         (select id from prayer_requests where body = 'anonymous prayer a') as anon;
grant select on tests.ids to authenticated;

-- ---------- A plain admin still sees no group content ----------
select tests.login('b', 'admin');
select is(tests.n('select 1 from group_messages'), 0, 'an admin who is not an overseer reads no group chat');
select is(tests.n('select 1 from weekly_checkins'), 0, 'nor check-ins');
select is(tests.n(format('select * from group_prayer_wall(%L)', tests.g('b', 1))), 0, 'nor a group prayer wall');
select is(tests.n(format('select * from group_contact_logs(%L)', tests.g('b', 1))), 0, 'nor contact logs');
reset role;

-- ---------- Overseer reads every group in his ministry ----------
select tests.login('a', 'admin');
select is(tests.n('select 1 from group_messages'), 2, 'overseer reads both groups'' chat');
select is(tests.n(format('select 1 from group_messages where ministry_id = %L', tests.m('b'))), 0, 'but no other ministry''s chat');
select is(tests.n($$select 1 from prayer_requests where visibility = 'group'$$), 3, 'overseer reads every group prayer request');
select is(tests.n(format('select 1 from prayer_requests where ministry_id = %L', tests.m('b'))), 0, 'but none in another ministry');
select is(tests.n('select 1 from prayer_interactions'), 2, 'and the responses on them');
select is(tests.n('select 1 from weekly_checkins where note is not null'), 1, 'overseer reads check-ins with notes');
select is(tests.n('select 1 from group_weekly_questions'), 1, 'and group questions');
select is(tests.n(format('select * from group_tiers(%L)', tests.g('a', 1))), 1, 'and a group''s tiers');
select is(tests.n(format('select * from group_tiers(%L)', tests.g('b', 1))), 0, 'but not another ministry''s tiers');
select is(tests.n(format('select * from group_contact_logs(%L)', tests.g('a', 2))), 1, 'and a group''s contact logs');
select is(tests.n(format('select * from group_contact_logs(%L)', tests.g('b', 2))), 0, 'but not another ministry''s');
select is(tests.n(format('select * from group_prayer_wall(%L)', tests.g('a', 1))), 2, 'group 1 prayer wall');
select is(tests.n(format('select * from group_prayer_wall(%L)', tests.g('b', 1))), 0, 'no prayer wall in another ministry');
select is((select author_name from group_prayer_wall(tests.g('a', 1)) where id = (select anon from tests.ids)), null,
  'anonymous requests stay anonymous to overseers');
select is(tests.n(format('select * from prayer_comments(%L)', (select pr1 from tests.ids))), 1, 'overseer reads the responses');
select is(tests.n('select 1 from lesson_progress where reflection is not null'), 0, 'overseer never reads reflections');
select is(tests.n('select note from contact_logs'), 0, 'overseer never reads contact log notes');

-- ---------- Never writes into a group ----------
select throws_ok(format($$insert into group_messages (ministry_id, group_id, profile_id, body) values (%L, %L, %L, 'hi')$$,
                        tests.m('a'), tests.g('a', 1), tests.u('a', 'admin')),
  '42501', null, 'overseer cannot post in a group chat');
select throws_ok(format($$insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind) values (%L, %L, %L, 'prayed')$$,
                        tests.m('a'), (select pr1 from tests.ids), tests.u('a', 'admin')),
  '42501', null, 'overseer cannot pray on a group request');
select throws_ok(format($$insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, body) values (%L, %L, %L, 'comment', 'x')$$,
                        tests.m('a'), (select pr1 from tests.ids), tests.u('a', 'admin')),
  '42501', null, 'overseer cannot respond on a group request');
reset role;

-- Men in the group still pray as before.
select tests.login('a', 'member');
select lives_ok(format($$insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, body) values (%L, %L, %L, 'comment', 'still works')$$,
                       tests.m('a'), (select pr1 from tests.ids), tests.u('a', 'member')),
  'a group member still responds on his group''s request');
select is(tests.n(format('select * from ministry_overseers(%L)', tests.m('a'))), 1, 'any member sees who the overseers are');
select is(tests.n(format('select * from ministry_overseers(%L)', tests.m('b'))), 0, 'but not another ministry''s');
reset role;

-- ---------- Granting ----------
select tests.login('b', 'admin');
select lives_ok(format('update ministry_members set is_overseer = true where ministry_id = %L and profile_id = %L',
                       tests.m('b'), tests.u('b', 'unplaced')),
  'an admin makes another admin an overseer');
reset role;
select is((select overseer_granted_by from ministry_members where ministry_id = tests.m('b') and profile_id = tests.u('b', 'unplaced')),
  tests.u('b', 'admin'), 'the grant is stamped with who gave it');

select tests.login('b', 'admin');
select throws_ok(format('update ministry_members set is_overseer = true where ministry_id = %L and profile_id = %L',
                        tests.m('b'), tests.u('b', 'admin')),
  '42501', null, 'an admin cannot make himself an overseer');
select lives_ok(format($$update ministry_members set is_overseer = true where ministry_id = %L and profile_id = %L$$,
                       tests.m('b'), tests.u('b', 'leader')),
  'flagging a leader runs');
select lives_ok(format($$update ministry_members set role = 'member' where ministry_id = %L and profile_id = %L$$,
                       tests.m('b'), tests.u('b', 'unplaced')),
  'demoting an overseer runs');
reset role;
select is((select is_overseer from ministry_members where ministry_id = tests.m('b') and profile_id = tests.u('b', 'leader')),
  false, 'a non-admin is never an overseer');
select is((select is_overseer from ministry_members where ministry_id = tests.m('b') and profile_id = tests.u('b', 'unplaced')),
  false, 'an overseer who stops being an admin loses the flag');

select tests.login('a', 'member');
select lives_ok(format('update ministry_members set is_overseer = true where ministry_id = %L and profile_id = %L',
                       tests.m('a'), tests.u('a', 'member')),
  'a member''s attempt to flag himself runs');
reset role;
select is((select is_overseer from ministry_members where ministry_id = tests.m('a') and profile_id = tests.u('a', 'member')),
  false, 'and is not flagged');

select * from finish();
rollback;
