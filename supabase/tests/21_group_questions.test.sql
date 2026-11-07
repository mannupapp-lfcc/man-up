-- Group questions (0019): only the men currently in the group read a group's
-- questions; only that group's leader or co-leader writes them. The Sanity question
-- sets (weekly_questions) are gone.
begin;
select no_plan();

create table tests.wk as select date_trunc('week', current_date)::date as monday;
grant select on tests.wk to authenticated;

select is(to_regclass('public.weekly_questions'), null, 'the Sanity weekly_questions table is dropped');

-- Reads
select tests.login('a', 'member');
select is(tests.n('select 1 from group_weekly_questions'), 1, 'a man reads his own group''s questions');
select tests.login('a', 'other');
select is(tests.n('select 1 from group_weekly_questions'), 0, 'a man in another group cannot');
select tests.login('a', 'other_leader');
select is(tests.n('select 1 from group_weekly_questions'), 0, 'the leader of another group cannot');
select tests.login('a', 'former');
select is(tests.n('select 1 from group_weekly_questions'), 0, 'a man who left the group cannot');
select tests.login('a', 'unplaced');
select is(tests.n('select 1 from group_weekly_questions'), 0, 'a man in no group cannot');
select tests.login('a', 'admin');
select is(tests.n('select 1 from group_weekly_questions'), 0, 'a ministry admin outside the group cannot');
reset role;

-- Leaders write: the co-leader edits this week's set and posts next week's.
select tests.login('a', 'colead');
select lives_ok(format($$update group_weekly_questions set questions = '["New Q1", "New Q2"]', posted_by = %L
                         where group_id = %L$$, tests.u('a', 'colead'), tests.g('a', 1)),
  'the co-leader edits his group''s questions');
select lives_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions, posted_by)
                         values (%L, %L, (select monday from tests.wk) + 7, '["Next week"]', %L)$$,
                       tests.m('a'), tests.g('a', 1), tests.u('a', 'colead')),
  'the co-leader posts next week''s questions');
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions, posted_by)
                          values (%L, %L, (select monday from tests.wk) + 14, '["Q"]', %L)$$,
                        tests.m('a'), tests.g('a', 1), tests.u('a', 'leader')),
  '42501', null, 'he cannot post in another man''s name');
reset role;
select is((select jsonb_array_length(questions) from group_weekly_questions
           where group_id = tests.g('a', 1) and week_of = (select monday from tests.wk)), 2,
  'the edit is saved');

-- Members, other leaders, and admins cannot write.
select tests.login('a', 'member');
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions, posted_by)
                          values (%L, %L, (select monday from tests.wk) + 14, '["Q"]', %L)$$,
                        tests.m('a'), tests.g('a', 1), tests.u('a', 'member')),
  '42501', null, 'a member cannot post questions');
select lives_ok(format($$update group_weekly_questions set title = 'member edit' where group_id = %L$$, tests.g('a', 1)),
  'a member''s edit runs');
select lives_ok(format($$delete from group_weekly_questions where group_id = %L$$, tests.g('a', 1)),
  'a member''s delete runs');
reset role;
select is(tests.n(format($$select 1 from group_weekly_questions where group_id = %L and title = 'member edit'$$, tests.g('a', 1))), 0,
  'but changes nothing');
select is(tests.n(format('select 1 from group_weekly_questions where group_id = %L', tests.g('a', 1))), 2,
  'and removes nothing');

select tests.login('a', 'other_leader');
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions, posted_by)
                          values (%L, %L, (select monday from tests.wk) + 14, '["Q"]', %L)$$,
                        tests.m('a'), tests.g('a', 1), tests.u('a', 'other_leader')),
  '42501', null, 'another group''s leader cannot post for group 1');
reset role;

select tests.login('a', 'admin');
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions, posted_by)
                          values (%L, %L, (select monday from tests.wk) + 14, '["Q"]', %L)$$,
                        tests.m('a'), tests.g('a', 1), tests.u('a', 'admin')),
  '42501', null, 'an admin who does not lead the group cannot post');
reset role;

select tests.login('a', 'leader');
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions, posted_by)
                          values (%L, %L, (select monday from tests.wk) + 14, '["Q"]', %L)$$,
                        tests.m('b'), tests.g('b', 1), tests.u('a', 'leader')),
  '42501', null, 'a leader cannot post into another ministry');
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions, posted_by)
                          values (%L, %L, (select monday from tests.wk), '["Again"]', %L)$$,
                        tests.m('a'), tests.g('a', 1), tests.u('a', 'leader')),
  '23505', null, 'one set per group per week');
select lives_ok(format($$delete from group_weekly_questions where group_id = %L and week_of > (select monday from tests.wk)$$,
                       tests.g('a', 1)),
  'the leader removes next week''s set');
reset role;
select is(tests.n(format('select 1 from group_weekly_questions where group_id = %L', tests.g('a', 1))), 1,
  'and it is gone');

-- Shape
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions)
                          values (%L, %L, (select monday from tests.wk) + 2, '["Q"]')$$, tests.m('a'), tests.g('a', 2)),
  '23514', null, 'week_of must be a Monday');
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions)
                          values (%L, %L, (select monday from tests.wk), '[]')$$, tests.m('a'), tests.g('a', 2)),
  '23514', null, 'at least one question');
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions)
                          values (%L, %L, (select monday from tests.wk), '["Q", "  "]')$$, tests.m('a'), tests.g('a', 2)),
  '23514', null, 'no blank questions');
select throws_ok(format($$insert into group_weekly_questions (ministry_id, group_id, week_of, questions)
                          values (%L, %L, (select monday from tests.wk), '["Q", 3]')$$, tests.m('a'), tests.g('a', 2)),
  '23514', null, 'questions are text');

select * from finish();
rollback;
