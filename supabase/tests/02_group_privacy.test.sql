-- (b) group_messages are visible only to current members of that group.
-- Same wall for the prayer wall, which is scoped to the group it was shared in.
-- Admins get no browse access to either (privacy wall).
begin;
select no_plan();

-- ---------- Chat reads ----------
select tests.login('a', 'member');
select is(tests.n('select 1 from group_messages'), 1, 'member reads only his group''s messages');
select is(tests.n(format('select 1 from group_messages where group_id = %L', tests.g('a', 2))),
          0, 'member cannot read another group''s messages');
reset role;

select tests.login('a', 'leader');
select is(tests.n('select 1 from group_messages'), 1, 'leader reads his own group''s messages only');
reset role;

select tests.login('a', 'other');
select is(tests.n(format('select 1 from group_messages where group_id = %L', tests.g('a', 2))),
          1, 'group 2 member reads group 2 messages');
select is(tests.n(format('select 1 from group_messages where group_id = %L', tests.g('a', 1))),
          0, 'group 2 member cannot read group 1 messages');
reset role;

select tests.login('a', 'former');
select is(tests.n('select 1 from group_messages'), 0, 'a man who left the group loses chat access');
reset role;

select tests.login('a', 'unplaced');
select is(tests.n('select 1 from group_messages'), 0, 'unplaced man reads no chat');
reset role;

select tests.login('a', 'admin');
select is(tests.n('select 1 from group_messages'), 0, 'admin has no browse access to chat');
select is(tests.n('select 1 from prayer_requests'), 0, 'admin has no browse access to prayer');
select is(tests.n('select 1 from prayer_interactions'), 0, 'admin has no browse access to prayer interactions');
reset role;

-- ---------- Chat writes ----------
select tests.login('a', 'member');
select lives_ok(
  format($$insert into group_messages (ministry_id, group_id, profile_id, body)
           values (%L, %L, %L, 'hi')$$, tests.m('a'), tests.g('a', 1), tests.u('a', 'member')),
  'member posts in his own group');
select throws_ok(
  format($$insert into group_messages (ministry_id, group_id, profile_id, body)
           values (%L, %L, %L, 'hi')$$, tests.m('a'), tests.g('a', 2), tests.u('a', 'member')),
  '42501', null, 'member cannot post into another group');
select throws_ok(
  format($$insert into group_messages (ministry_id, group_id, profile_id, body)
           values (%L, %L, %L, 'hi')$$, tests.m('a'), tests.g('a', 1), tests.u('a', 'member2')),
  '42501', null, 'member cannot post as another man');
reset role;

select tests.login('a', 'former');
select throws_ok(
  format($$insert into group_messages (ministry_id, group_id, profile_id, body)
           values (%L, %L, %L, 'hi')$$, tests.m('a'), tests.g('a', 1), tests.u('a', 'former')),
  '42501', null, 'a man who left cannot post to his old group');
reset role;

-- ---------- Prayer wall ----------
select tests.login('a', 'member');
select is(tests.n('select 1 from prayer_requests'), 2, 'member reads his group''s prayer requests only');
select is(tests.n('select 1 from prayer_interactions'), 1, 'member reads interactions on his group''s requests');
select throws_ok('select profile_id from prayer_requests', '42501', null,
                 'prayer author (profile_id) is not readable, so anonymous posts stay anonymous');
select throws_ok(
  format($$insert into prayer_requests (ministry_id, group_id, profile_id, body)
           values (%L, %L, %L, 'x')$$, tests.m('a'), tests.g('a', 2), tests.u('a', 'member')),
  '42501', null, 'member cannot post a prayer request to another group');
reset role;

select tests.login('a', 'other');
select is(tests.n('select 1 from prayer_requests'), 1, 'group 2 member reads only group 2 prayer');
select is(tests.n('select 1 from prayer_interactions'), 0, 'group 2 member reads no group 1 interactions');
reset role;

select tests.login('a', 'former');
select is(tests.n('select 1 from prayer_requests'), 0, 'a man who left loses his old group''s prayer wall');
reset role;

select * from finish();
rollback;
