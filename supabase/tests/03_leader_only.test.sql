-- (c) contact_logs and other men's lesson reflections are invisible to members.
-- Leaders see contact logs and attendance for their own group only.
begin;
select no_plan();

-- ---------- contact_logs ----------
select tests.login('a', 'member');
select is(tests.n('select 1 from contact_logs'), 0, 'member cannot read contact logs, even about himself');
select throws_ok(
  format($$insert into contact_logs (ministry_id, profile_id, leader_id, method)
           values (%L, %L, %L, 'call')$$, tests.m('a'), tests.u('a', 'member2'), tests.u('a', 'member')),
  '42501', null, 'member cannot log a contact');
reset role;

select tests.login('a', 'member2');  select is(tests.n('select 1 from contact_logs'), 0, 'member2 reads no contact logs');  reset role;
select tests.login('a', 'other');    select is(tests.n('select 1 from contact_logs'), 0, 'other reads no contact logs');    reset role;
select tests.login('a', 'unplaced'); select is(tests.n('select 1 from contact_logs'), 0, 'unplaced reads no contact logs'); reset role;

select tests.login('a', 'admin');
select is(tests.n('select 1 from contact_logs'), 0, 'admin cannot read contact notes (privacy wall)');
reset role;

select tests.login('a', 'leader');
select is(tests.n('select 1 from contact_logs'), 1, 'leader reads contact logs for his group');
select is(tests.n(format('select 1 from contact_logs where profile_id = %L', tests.u('a', 'other'))),
          0, 'leader cannot read contact logs about another group''s man');
select lives_ok(
  format($$insert into contact_logs (ministry_id, profile_id, leader_id, method)
           values (%L, %L, %L, 'text')$$, tests.m('a'), tests.u('a', 'member2'), tests.u('a', 'leader')),
  'leader logs a contact with a man in his group');
select throws_ok(
  format($$insert into contact_logs (ministry_id, profile_id, leader_id, method)
           values (%L, %L, %L, 'text')$$, tests.m('a'), tests.u('a', 'other'), tests.u('a', 'leader')),
  '42501', null, 'leader cannot log a contact with a man outside his group');
reset role;

select tests.login('a', 'colead');
select is(tests.n('select 1 from contact_logs'), 2,
          'co-leader reads his group''s contact logs, including the one the leader just logged');
reset role;

select tests.login('a', 'other_leader');
select is(tests.n('select 1 from contact_logs'), 1, 'group 2 leader reads only group 2 contact logs');
reset role;

-- ---------- lesson reflections ----------
select tests.login('a', 'member');
select is(tests.n('select 1 from lesson_progress'), 1, 'member reads only his own lesson progress');
select is(tests.n(format('select 1 from lesson_progress where profile_id = %L', tests.u('a', 'member2'))),
          0, 'member cannot read another man''s reflection');
select throws_ok(
  format($$insert into lesson_progress (ministry_id, lesson_id, profile_id)
           select %L, id, %L from lessons limit 1$$, tests.m('a'), tests.u('a', 'member2')),
  '42501', null, 'member cannot write progress for another man');
reset role;

select tests.login('a', 'leader');
select is(tests.n('select 1 from lesson_progress'), 0, 'leader cannot read his men''s reflections');
reset role;

select tests.login('a', 'admin');
select is(tests.n('select 1 from lesson_progress'), 0, 'admin cannot read reflections');
reset role;

-- ---------- attendance: a man sees only his own ----------
select tests.login('a', 'member');
select is(tests.n('select 1 from meeting_attendance'), 1, 'member sees only his own attendance');
reset role;

select tests.login('a', 'leader');
select is(tests.n('select 1 from meeting_attendance'), 4, 'leader sees his group''s attendance');
reset role;

select tests.login('a', 'other_leader');
select is(tests.n('select 1 from meeting_attendance'), 1, 'group 2 leader sees only group 2 attendance');
reset role;

select tests.login('a', 'admin');
select is(tests.n('select 1 from meeting_attendance'), 5, 'admin sees attendance ministry-wide');
reset role;

-- ---------- serve logs ----------
select tests.login('a', 'member');
select is(tests.n('select 1 from serve_logs'), 1, 'member sees his own serve log');
reset role;
select tests.login('a', 'member2');
select is(tests.n('select 1 from serve_logs'), 0, 'member2 cannot see another man''s serve log');
reset role;

-- ---------- ministry_members and profiles ----------
select tests.login('a', 'member');
select is(tests.n('select 1 from ministry_members'), 1, 'member reads only his own ministry membership');
select is(tests.n('select 1 from profiles'), 4, 'member reads his own profile and current group mates');
select is(tests.n(format('select 1 from profiles where id = %L', tests.u('a', 'former'))),
          0, 'member cannot read the profile of a man who left the group');
select is(tests.n(format('select 1 from profiles where id = %L', tests.u('a', 'other'))),
          0, 'member cannot read a profile outside his group');
reset role;

select tests.login('a', 'admin');
select is(tests.n('select 1 from profiles'), 9, 'admin reads profiles of all his ministry''s men');
reset role;

select * from finish();
rollback;
