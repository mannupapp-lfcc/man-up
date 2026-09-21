-- Scoring visibility, season flags, and logged tuning.
begin;
select no_plan();

-- ---------- Members: own tier only, never a number ----------
select tests.login('a', 'member');
select is((select tier from my_progress(tests.m('a'))), 'Thriving', 'a man sees his own tier');
select throws_ok($$ select total from my_progress(tests.m('a')) $$, '42703', null, 'my_progress() exposes no number');
select is((select count(*)::int from group_tiers(tests.g('a', 1))), 0, 'a member cannot read his group''s tiers');
select is(tests.n('select 1 from season_flags'), 0, 'a member cannot see season flags');
select is(tests.n('select 1 from group_scores'), 0, 'a member cannot see group health');
reset role;

select tests.login('a', 'member2');
select is((select tier from my_progress(tests.m('a'))), null, 'no score yet means no tier (not someone else''s)');
select is((select count(*)::int from my_progress(tests.m('b'))), 0, 'nothing for a ministry he is not in');
reset role;

-- ---------- Leaders: tiers for their group only ----------
select tests.login('a', 'leader');
select is((select tier from group_tiers(tests.g('a', 1)) where profile_id = tests.u('a', 'member')), 'Thriving',
          'leader sees his man''s tier');
select is((select count(*)::int from group_tiers(tests.g('a', 2))), 0, 'but not another group''s');
select is(tests.n('select 1 from season_flags'), 1, 'leader sees the season flag for his man');
select is(tests.n('select 1 from group_scores'), 0, 'leaders do not see group health (admin board)');
select is(tests.n('select 1 from leader_scores'), 0, 'leaders do not see leader scores');
select lives_ok(format($$insert into season_flags (ministry_id, profile_id, set_by, ends_on) values (%L, %L, %L, current_date + 30)$$,
                       tests.m('a'), tests.u('a', 'member'), tests.u('a', 'leader')),
                'leader sets a season flag for his man');
select throws_ok(format($$insert into season_flags (ministry_id, profile_id, set_by, ends_on) values (%L, %L, %L, current_date + 61)$$,
                        tests.m('a'), tests.u('a', 'member'), tests.u('a', 'leader')),
                 '23514', null, 'a season flag lasts at most 60 days');
select throws_ok(format($$insert into season_flags (ministry_id, profile_id, set_by, ends_on) values (%L, %L, %L, current_date + 10)$$,
                        tests.m('a'), tests.u('a', 'other'), tests.u('a', 'leader')),
                 '42501', null, 'leader cannot flag a man outside his group');
reset role;

-- ---------- Admins: numbers, health, tuning ----------
select tests.login('a', 'admin');
select is(tests.n('select 1 from group_scores'), 1, 'admin sees group health');
select is(tests.n('select 1 from season_flags'), 2, 'admin sees every season flag (the fixture''s and the one the leader just set)');
select throws_ok(format($$ select set_score_config(%L, 'test_weight', 5, '  ') $$, tests.m('a')),
                 '22023', null, 'a tuning change needs a reason');
select lives_ok(format($$ select set_score_config(%L, 'test_weight', 5, 'calibration review') $$, tests.m('a')),
                'admin tunes a weight with a reason');
select is((select value from score_config where ministry_id = tests.m('a') and key = 'test_weight'), 5::numeric, 'weight saved');
select is((select count(*)::int from score_config_changes where ministry_id = tests.m('a') and reason = 'calibration review'), 1,
          'change logged with its reason');
select throws_ok(format($$ select set_score_config(%L, 'test_weight', 5, 'x') $$, tests.m('b')),
                 '42501', null, 'admin cannot tune another ministry');
reset role;

select tests.login('a', 'leader');
select throws_ok(format($$ select set_score_config(%L, 'test_weight', 9, 'x') $$, tests.m('a')),
                 '42501', null, 'a leader cannot tune scoring');
reset role;

select ok((select count(*) from score_config where ministry_id = '00000000-0000-0000-0000-000000000002' and key like 'individual.%') >= 10,
          'Man Up has default weights from the scoring plan');

select * from finish();
rollback;
