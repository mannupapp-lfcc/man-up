-- Delete account (0015): he deletes only himself, everything that is his goes with
-- him, and other men's history survives with the "done by" column blanked.
begin;
select no_plan();

-- Signed out: nothing to delete.
select throws_ok($$select delete_my_account()$$, '42501', null, 'signed-out callers cannot delete');

-- 'member' has a message, prayer request (with member2's "I prayed"), check-in,
-- attendance, scores, a contact log about him, a serve log, a token, a PCO match.
select tests.login('a', 'member');
select lives_ok($$select delete_my_account()$$, 'he deletes his account');
reset role;

select is(tests.n(format('select 1 from auth.users where id = %L', tests.u('a', 'member'))), 0, 'his sign-in is gone');
select is(tests.n(format('select 1 from profiles where id = %L', tests.u('a', 'member'))), 0, 'his profile is gone');
select is(tests.n(format('select 1 from ministry_members where profile_id = %L', tests.u('a', 'member'))), 0, 'his membership is gone');
select is(tests.n(format('select 1 from group_messages where profile_id = %L', tests.u('a', 'member'))), 0, 'his messages are gone');
select is(tests.n($$select 1 from prayer_requests where body = 'member prayer a'$$), 0, 'his prayer request is gone');
select is(tests.n($$select 1 from prayer_interactions where profile_id = tests.u('a', 'member2')$$), 0,
  '"I prayed" taps on his request went with it');
select is(tests.n(format('select 1 from weekly_checkins where profile_id = %L', tests.u('a', 'member'))), 0, 'his check-ins are gone');
select is(tests.n(format('select 1 from meeting_attendance where profile_id = %L', tests.u('a', 'member'))), 0, 'his attendance is gone');
select is(tests.n(format('select 1 from member_scores where profile_id = %L', tests.u('a', 'member'))), 0, 'his scores are gone');
select is(tests.n(format('select 1 from contact_logs where profile_id = %L', tests.u('a', 'member'))), 0, 'contact logs about him are gone');
select is(tests.n(format('select 1 from push_tokens where profile_id = %L', tests.u('a', 'member'))), 0, 'his push tokens are gone');
select is(tests.n(format('select 1 from push_outbox where profile_id = %L', tests.u('a', 'member'))), 0, 'his queued pushes are gone');
select is(tests.n(format('select 1 from lesson_progress where profile_id = %L', tests.u('a', 'member'))), 0, 'his reflections are gone');

select is(tests.n(format('select 1 from profiles where id = %L', tests.u('a', 'member2'))), 1, 'other men are untouched');
select is(tests.n(format('select 1 from profiles where id = %L', tests.u('b', 'member'))), 1, 'ministry B is untouched');

-- A leader deletes his account: the attendance he marked and the flag he set stay.
select tests.login('a', 'leader');
select lives_ok($$select delete_my_account()$$, 'a leader deletes his account');
reset role;
select is(tests.n(format('select 1 from meeting_attendance where profile_id = %L and marked_by is null', tests.u('a', 'member2'))), 1,
  'attendance he marked for another man stays, marked_by blank');
select is(tests.n(format('select 1 from season_flags where profile_id = %L and set_by is null', tests.u('a', 'member2'))), 1,
  'a season flag he set stays, set_by blank');
select is(tests.n(format('select 1 from serve_claims where group_id = %L and claimed_by is null', tests.g('a', 1))), 1,
  'the group serve he claimed stays, claimed_by blank');

-- An admin deletes his account: the scoring change log and PCO match log stay.
select tests.login('a', 'admin');
select lives_ok($$select delete_my_account()$$, 'an admin deletes his account');
reset role;
select is(tests.n(format($$select 1 from score_config_changes where ministry_id = %L and changed_by is null$$, tests.m('a'))), 1,
  'the scoring change log stays, changed_by blank');
select is(tests.n(format($$select 1 from invite_codes where ministry_id = %L and created_by is null$$, tests.m('a'))), 1,
  'the invite code he made stays');

select * from finish();
rollback;
