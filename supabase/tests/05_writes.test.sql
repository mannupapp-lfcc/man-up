-- Write rules that protect identity, the 72-hour attendance gate, and signed-out access.
begin;
select no_plan();

-- ---------- Identity (Non-negotiable 4) ----------
select tests.login('a', 'member');
select throws_ok(
  format($$update profiles set pco_person_id = 'a-pco-1' where id = %L$$, tests.u('a', 'member')),
  '42501', null, 'member cannot set his own pco_person_id');
select throws_ok(
  format($$update profiles set organization_id = 'b0000000-0000-4000-8000-000000000001' where id = %L$$,
         tests.u('a', 'member')),
  '42501', null, 'member cannot move himself to another organization');
select lives_ok(
  format($$update profiles set full_name = 'Renamed' where id = %L$$, tests.u('a', 'member')),
  'member updates his own name');
select lives_ok(
  format($$update profiles set full_name = 'Hijacked' where id = %L$$, tests.u('a', 'member2')),
  'updating another man''s profile silently matches no rows');
reset role;
select is((select full_name from profiles where id = tests.u('a', 'member')), 'Renamed',
          'own name change was saved');
select is((select full_name from profiles where id = tests.u('a', 'member2')), 'member2 a',
          'another man''s profile was not changed');

-- ---------- Meetings and the 72-hour gate ----------
select tests.login('a', 'leader');
select lives_ok(
  format($$update meetings set attendance_marked_at = '2000-01-01'
           where group_id = %L and attendance_marked_at is null$$, tests.g('a', 1)),
  'leader marks his group''s meeting');
select throws_ok(
  format($$update meetings set meeting_at = now() where group_id = %L$$, tests.g('a', 1)),
  '42501', null, 'leader cannot reschedule a meeting');
reset role;
select is(
  tests.n(format($$select 1 from meetings where group_id = %L and meeting_at > now() - interval '2 days'
                   and attendance_marked_at = now()$$, tests.g('a', 1))),
  1, 'attendance_marked_at is set by the server clock, not the client value');

select tests.login('a', 'leader');
select lives_ok(
  format($$update meetings set attendance_marked_at = null where group_id = %L$$, tests.g('a', 1)),
  'leader attempts to clear a mark');
reset role;
select is(
  tests.n(format('select 1 from meetings where group_id = %L and attendance_marked_at is null', tests.g('a', 1))),
  0, 'a mark can never be cleared or moved once set');

select tests.login('a', 'member');
select lives_ok(
  format($$update meetings set attendance_marked_at = now() where group_id = %L$$, tests.g('a', 2)),
  'member update of a meeting matches no rows');
reset role;
select is(
  tests.n(format($$select 1 from meetings where group_id = %L and attendance_marked_at = now()$$, tests.g('a', 2))),
  0, 'member cannot mark meetings');

-- ---------- Attendance marking ----------
select tests.login('a', 'colead');
select lives_ok(
  format($$insert into meeting_attendance (ministry_id, meeting_id, profile_id, status, marked_by)
           select %L, id, %L, 'present', %L from meetings
           where group_id = %L and meeting_at > now() - interval '2 days'$$,
         tests.m('a'), tests.u('a', 'member2'), tests.u('a', 'colead'), tests.g('a', 1)),
  'co-leader marks attendance for a man in his group');
select throws_ok(
  format($$insert into meeting_attendance (ministry_id, meeting_id, profile_id, status, marked_by)
           select %L, id, %L, 'present', %L from meetings
           where group_id = %L and meeting_at > now() - interval '2 days'$$,
         tests.m('a'), tests.u('a', 'other'), tests.u('a', 'colead'), tests.g('a', 1)),
  '42501', null, 'co-leader cannot mark a man from another group');
reset role;

select tests.login('a', 'member');
select throws_ok(
  format($$insert into meeting_attendance (ministry_id, meeting_id, profile_id, status, marked_by)
           select ministry_id, id, %L, 'present', %L from meetings
           where group_id = %L and meeting_at > now() - interval '2 days'$$,
         tests.u('a', 'member'), tests.u('a', 'member'), tests.g('a', 1)),
  '42501', null, 'member cannot mark attendance');
reset role;

-- ---------- Church Center owns Saturday check-in for pco tenants ----------
select tests.login('a', 'member2');
select throws_ok(
  format($$insert into gathering_checkins (ministry_id, gathering_id, profile_id)
           select ministry_id, id, %L from gatherings limit 1$$, tests.u('a', 'member2')),
  '42501', null, 'no in-app gathering check-in when attendance_source is pco');
reset role;

-- ---------- Admin-only management ----------
select tests.login('a', 'leader');
select is(tests.n('select 1 from invite_codes'), 0, 'leader cannot read invite codes');
select lives_ok(
  format($$update ministry_members set role = 'admin' where profile_id = %L$$, tests.u('a', 'leader')),
  'leader self-promotion attempt runs');
reset role;
select is((select role::text from ministry_members where profile_id = tests.u('a', 'leader')), 'leader',
          'leader could not promote himself');

select tests.login('a', 'admin');
select is(tests.n('select 1 from invite_codes'), 1, 'admin reads his ministry''s invite codes');
select lives_ok(
  format($$update ministry_members set role = 'co_leader' where profile_id = %L$$, tests.u('a', 'member2')),
  'admin promotes a man to co-leader');
reset role;
select is((select role::text from ministry_members where profile_id = tests.u('a', 'member2')), 'co_leader',
          'promotion was saved');

-- ---------- PCO mirror is read-only to clients ----------
select tests.login('a', 'admin');
select is(tests.n('select 1 from pco_roster'), 1, 'admin reads the PCO roster (Match queue)');
select throws_ok(
  format($$insert into pco_roster (ministry_id, pco_person_id) values (%L, 'x')$$, tests.m('a')),
  '42501', null, 'admin cannot write the PCO mirror from the client');
reset role;
select tests.login('a', 'leader');
select is(tests.n('select 1 from pco_roster'), 0, 'leader cannot read the PCO roster');
reset role;

-- ---------- Signed-out callers ----------
set local role anon;
select throws_ok('select 1 from profiles', '42501', null, 'anon has no access to profiles');
select throws_ok('select 1 from group_messages', '42501', null, 'anon has no access to chat');
select throws_ok('select 1 from ministries', '42501', null, 'anon has no access to ministries');
reset role;

select * from finish();
rollback;
