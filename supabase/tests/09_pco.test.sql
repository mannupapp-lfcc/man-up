-- PCO: the Match queue is the only way pco_person_id is set; the mirror is read-only
-- to clients; attendance keeps one row per check-in.
begin;
select no_plan();

insert into pco_roster (ministry_id, pco_person_id, full_name) values
  (tests.m('a'), 'a-pco-2', 'member2 a'),
  (tests.m('b'), 'b-pco-9', 'someone b');

-- ---------- confirm_pco_match ----------
select tests.login('a', 'leader');
select throws_ok(format($$ select confirm_pco_match(%L, 'a-pco-2') $$, tests.u('a', 'member2')),
                 '42501', null, 'a leader cannot match');
reset role;

select tests.login('a', 'member2');
select throws_ok(format($$ select confirm_pco_match(%L, 'a-pco-2') $$, tests.u('a', 'member2')),
                 '42501', null, 'a man cannot match himself (Non-negotiable 4)');
reset role;

select tests.login('a', 'admin');
select throws_ok(format($$ select confirm_pco_match(%L, 'b-pco-9') $$, tests.u('a', 'member2')),
                 '42501', null, 'admin cannot match to a person on another ministry''s roster');
select throws_ok(format($$ select confirm_pco_match(%L, 'a-pco-2') $$, tests.u('b', 'member')),
                 '42501', null, 'admin cannot match a man from another ministry');
select lives_ok(format($$ select confirm_pco_match(%L, 'a-pco-2') $$, tests.u('a', 'member2')),
                'admin confirms a match from the roster');
select throws_ok(format($$ select confirm_pco_match(%L, 'a-pco-2') $$, tests.u('a', 'other')),
                 'P0001', null, 'one PCO person cannot be matched to two accounts');
reset role;
select is((select pco_person_id from profiles where id = tests.u('a', 'member2')), 'a-pco-2', 'match saved');
select is((select count(*)::int from pco_match_log where profile_id = tests.u('a', 'member2') and action = 'matched'
           and performed_by = tests.u('a', 'admin')), 1, 'match logged with who did it');

select tests.login('a', 'admin');
select lives_ok(format($$ select clear_pco_match(%L) $$, tests.u('a', 'member2')), 'admin clears a match');
reset role;
select is((select pco_person_id from profiles where id = tests.u('a', 'member2')), null, 'match cleared');
select is((select count(*)::int from pco_match_log where profile_id = tests.u('a', 'member2') and action = 'cleared'),
          1, 'clear logged');

set local role anon;
select throws_ok(format($$ select confirm_pco_match(%L, 'a-pco-2') $$, tests.u('a', 'member2')),
                 '42501', null, 'anon cannot call the match function');
reset role;

-- ---------- Mirror stays read-only to clients ----------
select tests.login('a', 'admin');
select throws_ok(format($$insert into pco_gathering_attendance (ministry_id, pco_person_id, pco_event_id, event_at, pco_check_in_id)
                          values (%L, 'x', 'e', now(), 'c1')$$, tests.m('a')),
                 '42501', null, 'admin cannot write PCO attendance from the client');
reset role;

-- ---------- Attendance keeps one row per check-in ----------
insert into pco_gathering_attendance (ministry_id, pco_person_id, pco_event_id, event_at, pco_check_in_id) values
  (tests.m('a'), 'a-pco-1', 'weekly-evt', now() - interval '14 days', 'ci-1'),
  (tests.m('a'), 'a-pco-1', 'weekly-evt', now() - interval '7 days',  'ci-2');
select is((select count(*)::int from pco_gathering_attendance where pco_event_id = 'weekly-evt'), 2,
          'two sessions of one weekly Check-Ins event are two rows');
select throws_ok(format($$insert into pco_gathering_attendance (ministry_id, pco_person_id, pco_event_id, event_at, pco_check_in_id)
                          values (%L, 'a-pco-1', 'weekly-evt', now(), 'ci-1')$$, tests.m('a')),
                 '23505', null, 'the same check-in cannot be stored twice');

select is((select value #>> '{}' from ministry_config
           where ministry_id = '00000000-0000-0000-0000-000000000002' and key = 'pco_group_id'),
          '157955', 'Man Up reads the Men''s Ministry group in PCO');

select * from finish();
rollback;
