-- My Group: schedule, meeting generation, attendance marking, placement, leaders.
begin;
select no_plan();

insert into ministry_config (ministry_id, key, value) values (tests.m('a'), 'timezone', '"America/New_York"');
update groups set meeting_day = 'Tuesday', meeting_time = '07:00' where id = tests.g('a', 1);
update groups set meeting_day = 'Thursday', meeting_time = '19:00' where id = tests.g('a', 2);

-- ---------- Schedule rules ----------
select throws_ok($$ update groups set meeting_day = 'Tues' where id = tests.g('a', 1) $$,
                 '23514', null, 'meeting_day must be a full day name');
select throws_ok(
  format($$insert into group_members (ministry_id, group_id, profile_id) values (%L, %L, %L)$$,
         tests.m('a'), tests.g('a', 2), tests.u('a', 'member')),
  '23505', null, 'a man cannot be active in two groups at once');

-- ---------- generate_meetings ----------
select tests.login('a', 'leader');
select throws_ok(format($$ select generate_meetings(%L) $$, tests.m('a')), '42501', null,
                 'a leader cannot generate meetings');
reset role;

select tests.login('a', 'admin');
select is(generate_meetings(tests.m('a'), 4), 8, 'admin generates 4 weeks for 2 groups');
select is(generate_meetings(tests.m('a'), 4), 0, 'running again creates nothing new');
reset role;
select is(
  tests.n(format($$select 1 from meetings where group_id = %L and meeting_at > now()
                   and extract(isodow from meeting_at at time zone 'America/New_York') = 2
                   and (meeting_at at time zone 'America/New_York')::time = '07:00'$$, tests.g('a', 1))),
  4, 'group 1 meetings are Tuesdays at 7:00 local time');
select is(tests.n(format('select 1 from meetings where ministry_id = %L and meeting_at > now()', tests.m('b'))),
          0, 'generation never touches another ministry');

-- Changing the schedule moves future meetings on the next run.
update groups set meeting_day = 'Wednesday' where id = tests.g('a', 1);
select tests.login('a', 'admin');
select is(generate_meetings(tests.m('a'), 4), 4, 'new schedule creates 4 new meetings');
reset role;
select is(
  tests.n(format($$select 1 from meetings where group_id = %L and meeting_at > now()
                   and extract(isodow from meeting_at at time zone 'America/New_York') = 2$$, tests.g('a', 1))),
  0, 'future meetings on the old day were removed');
select is(tests.n(format('select 1 from meetings where group_id = %L and meeting_at < now()', tests.g('a', 1))),
          2, 'past meetings were left alone');

-- ---------- mark_attendance ----------
-- Group 1's unmarked past meeting (from the fixture): members leader, colead, member, member2.
create table tests.mt as
  select id from meetings where group_id = tests.g('a', 1) and meeting_at between now() - interval '2 days' and now();
grant select on tests.mt to authenticated;

select tests.login('a', 'member');
select throws_ok(format($$ select mark_attendance(%L, array[%L]::uuid[]) $$,
                        (select id from tests.mt), tests.u('a', 'member')),
                 '42501', null, 'a member cannot mark attendance');
reset role;

select tests.login('a', 'other_leader');
select throws_ok(format($$ select mark_attendance(%L, array[]::uuid[]) $$, (select id from tests.mt)),
                 'P0002', null, 'another group''s leader cannot even see the meeting');
reset role;

select tests.login('a', 'colead');
select throws_ok(format($$ select mark_attendance(%L, array[%L]::uuid[]) $$,
                        (select id from tests.mt), tests.u('a', 'other')),
                 'P0001', null, 'only men in the group can be marked');
select throws_ok(format($$ select mark_attendance(id, array[]::uuid[]) from meetings
                           where group_id = %L and meeting_at > now() limit 1 $$, tests.g('a', 1)),
                 'P0001', null, 'a future meeting cannot be marked');
select lives_ok(format($$ select mark_attendance(%L, array[%L, %L]::uuid[], array[%L]::uuid[]) $$,
                       (select id from tests.mt), tests.u('a', 'leader'), tests.u('a', 'member'),
                       tests.u('a', 'member2')),
                'co-leader marks the whole meeting');
reset role;

select results_eq(
  format($$ select p.full_name, a.status::text from meeting_attendance a
            join profiles p on p.id = a.profile_id where a.meeting_id = %L order by 1 $$,
         (select id from tests.mt)),
  $$ values ('colead a', 'absent'), ('leader a', 'present'), ('member a', 'present'), ('member2 a', 'excused') $$,
  'everyone not listed is absent; the man who left is not included');
select is((select attendance_marked_at from meetings where id = (select id from tests.mt)), now(),
          'meeting is stamped as marked');

select tests.login('a', 'leader');
select lives_ok(format($$ select mark_attendance(%L, array[%L]::uuid[]) $$,
                       (select id from tests.mt), tests.u('a', 'colead')),
                'leader corrects the attendance');
reset role;
select is((select status::text from meeting_attendance where meeting_id = (select id from tests.mt)
           and profile_id = tests.u('a', 'colead')), 'present', 'correction saved');
select is((select marked_by from meeting_attendance where meeting_id = (select id from tests.mt)
           and profile_id = tests.u('a', 'colead')), tests.u('a', 'leader'), 'marked_by is the corrector');

-- ---------- place_member ----------
select tests.login('a', 'leader');
select throws_ok(format($$ select place_member(%L, %L) $$, tests.g('a', 1), tests.u('a', 'unplaced')),
                 '42501', null, 'a leader cannot place men');
reset role;

select tests.login('a', 'admin');
select lives_ok(format($$ select place_member(%L, %L) $$, tests.g('a', 1), tests.u('a', 'unplaced')),
                'admin places an unplaced man');
select lives_ok(format($$ select place_member(%L, %L) $$, tests.g('a', 2), tests.u('a', 'member2')),
                'admin moves a man to another group');
select lives_ok(format($$ select place_member(%L, %L) $$, tests.g('a', 1), tests.u('a', 'former')),
                'admin brings a man back to a group he left');
select throws_ok(format($$ select place_member(%L, %L) $$, tests.g('a', 1), tests.u('b', 'member')),
                 'P0001', null, 'admin cannot place a man from another ministry');
select throws_ok(format($$ select place_member(%L, %L) $$, tests.g('b', 1), tests.u('a', 'member')),
                 '42501', null, 'admin cannot place into another ministry''s group');
reset role;
select is(tests.n(format('select 1 from group_members where profile_id = %L and left_at is null', tests.u('a', 'member2'))),
          1, 'a moved man is active in exactly one group');
select is((select group_id from group_members where profile_id = tests.u('a', 'member2') and left_at is null),
          tests.g('a', 2), 'and it is the new group');
select is((select left_at from group_members where profile_id = tests.u('a', 'former') and group_id = tests.g('a', 1)),
          null, 'the returning man is active again');

-- ---------- set_group_leader ----------
select tests.login('a', 'admin');
select lives_ok(format($$ select set_group_leader(%L, %L, 'co_leader') $$, tests.g('a', 1), tests.u('a', 'unplaced')),
                'admin makes a man co-leader of his group');
select throws_ok(format($$ select set_group_leader(%L, %L, 'leader') $$, tests.g('a', 1), tests.u('a', 'other')),
                 'P0001', null, 'a man must be in the group to lead it');
select throws_ok(format($$ select set_group_leader(%L, %L, 'admin') $$, tests.g('a', 1), tests.u('a', 'member')),
                 '22023', null, 'set_group_leader cannot grant admin');
reset role;
select is((select role::text from ministry_members where profile_id = tests.u('a', 'unplaced')), 'co_leader',
          'his ministry role is now co_leader');
select is((select is_group_leader from group_members where profile_id = tests.u('a', 'unplaced') and left_at is null),
          true, 'he is flagged as a group leader');

select tests.login('a', 'unplaced');
select is(tests.n(format('select 1 from meeting_attendance a join meetings m on m.id = a.meeting_id where m.group_id = %L',
                         tests.g('a', 1))),
          8, 'the new co-leader now sees attendance for both of his group''s marked meetings');
reset role;

select * from finish();
rollback;
