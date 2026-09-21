-- Sanity content mirror: members read published content of their own ministry only;
-- clients never write it (the webhook route does, with the service role).
begin;
select no_plan();

insert into gathering_content (ministry_id, sanity_id, gathering_date, topic, is_published)
  values (tests.m('a'), 'a-gc-draft', current_date, 'Unpublished', false);
insert into lessons (ministry_id, course_id, sanity_id, title, sort_order, is_published)
  select tests.m('a'), id, 'a-lesson-hidden', 'Hidden', 2, false from courses where sanity_id = 'a-course-1';

select tests.login('a', 'member');
select is(tests.n('select 1 from gathering_content'), 1, 'member reads published gathering content only');
select is(tests.n('select 1 from weekly_questions'), 1, 'member reads his ministry''s weekly questions');
select is(tests.n('select 1 from lessons'), 1, 'unpublished lessons and lessons of draft courses are hidden');
select is(tests.n('select 1 from courses'), 1, 'draft courses are hidden');
select throws_ok(format($$insert into weekly_questions (ministry_id, sanity_id, week_of) values (%L, 'x', current_date)$$, tests.m('a')),
                 '42501', null, 'members cannot write content');
reset role;

select tests.login('a', 'admin');
select throws_ok(format($$insert into gathering_content (ministry_id, sanity_id, gathering_date) values (%L, 'x', current_date)$$, tests.m('a')),
                 '42501', null, 'admins author in Sanity, not by writing the mirror');
reset role;

set local role anon;
select throws_ok('select 1 from weekly_questions', '42501', null, 'anon has no access to content');
reset role;

select * from finish();
rollback;
