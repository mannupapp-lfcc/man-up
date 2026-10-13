-- How often a group meets (0017): every other week creates meetings only in meeting
-- weeks, back to weekly fills the gaps, and a cadence needs a start week.
begin;
select no_plan();

-- Group 1 meets tomorrow's weekday at 7:00 New York time (so nothing falls earlier
-- today, and four weeks hold exactly four of that weekday).
insert into ministry_config (ministry_id, key, value) values (tests.m('a'), 'timezone', '"America/New_York"');
create table tests.today as select (now() at time zone 'America/New_York')::date as d;
update groups set meeting_day = trim(to_char((select d from tests.today) + 1, 'Day')), meeting_time = '07:00'
  where id = tests.g('a', 1);

-- Group 1 meets every other week, starting the week of the 8th day from now (so the
-- first upcoming week is skipped whatever weekday today is).
update groups set status = 'active', meeting_every_weeks = 2, meeting_start_date = (select d from tests.today) + 7
  where id = tests.g('a', 1);
select tests.login('a', 'admin');
select lives_ok(format($$select generate_meetings(%L, 4)$$, tests.m('a')), 'admin generates meetings');
reset role;

select is(tests.n(format('select 1 from meetings where group_id = %L and meeting_at > now()', tests.g('a', 1))), 2,
  'every other week: two meetings in the next four weeks');
select is(tests.n(format($$select 1 from meetings where group_id = %L and meeting_at > now()
                           and not fn_is_meeting_week((meeting_at at time zone 'America/New_York')::date, 2::smallint, (select d from tests.today) + 7)$$,
                         tests.g('a', 1))), 0,
  'and only in meeting weeks');
select is(tests.n(format($$select 1 from meetings where group_id = %L and meeting_at > now()
                           and date_trunc('week', meeting_at at time zone 'America/New_York') = date_trunc('week', ((select d from tests.today) + 7)::timestamp)$$,
                         tests.g('a', 1))), 1,
  'the start week is a meeting week');

-- Back to weekly: the skipped weeks fill in.
update groups set meeting_every_weeks = 1 where id = tests.g('a', 1);
select tests.login('a', 'admin');
select is(generate_meetings(tests.m('a'), 4), 2, 'weekly again fills the two skipped weeks');
reset role;

-- Changing the start week moves future meetings to the other weeks.
update groups set meeting_every_weeks = 2, meeting_start_date = (select d from tests.today) + 14 where id = tests.g('a', 1);
select tests.login('a', 'admin');
select lives_ok(format($$select generate_meetings(%L, 4)$$, tests.m('a')), 'admin regenerates');
reset role;
select is(tests.n(format($$select 1 from meetings where group_id = %L and meeting_at > now()
                           and not fn_is_meeting_week((meeting_at at time zone 'America/New_York')::date, 2::smallint, (select d from tests.today) + 14)$$,
                         tests.g('a', 1))), 0,
  'meetings outside the new meeting weeks were removed');

select throws_ok(format($$update groups set meeting_every_weeks = 2, meeting_start_date = null where id = %L$$, tests.g('a', 2)),
  '23514', null, 'less than weekly needs a start week');
select throws_ok(format($$update groups set meeting_every_weeks = 5, meeting_start_date = current_date where id = %L$$, tests.g('a', 2)),
  '23514', null, 'at most every fourth week');
select is(tests.n(format('select 1 from meetings where ministry_id = %L and meeting_at > now()', tests.m('b'))), 0,
  'generation never touches another ministry');

select * from finish();
rollback;
