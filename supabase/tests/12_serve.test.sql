-- Serve: group projects (claim, opt in, confirm) and the serve mirror.
begin;
select no_plan();

insert into serve_opportunities (ministry_id, title, pco_signup_id) values (tests.m('a'), 'Fall Festival', 's-1');
create table tests.opp as select id from serve_opportunities where pco_signup_id = 's-1';
grant select on tests.opp to authenticated;

-- ---------- Claiming ----------
select tests.login('a', 'member');
select throws_ok(format($$insert into serve_claims (ministry_id, group_id, opportunity_id, claimed_by) values (%L, %L, %L, %L)$$,
                        tests.m('a'), tests.g('a', 1), (select id from tests.opp), tests.u('a', 'member')),
                 '42501', null, 'a member cannot claim a project for his group');
reset role;

select tests.login('a', 'other_leader');
select throws_ok(format($$insert into serve_claims (ministry_id, group_id, opportunity_id, claimed_by) values (%L, %L, %L, %L)$$,
                        tests.m('a'), tests.g('a', 1), (select id from tests.opp), tests.u('a', 'other_leader')),
                 '42501', null, 'a leader cannot claim for another group');
reset role;

select tests.login('a', 'colead');
select lives_ok(format($$insert into serve_claims (ministry_id, group_id, opportunity_id, claimed_by) values (%L, %L, %L, %L)$$,
                       tests.m('a'), tests.g('a', 1), (select id from tests.opp), tests.u('a', 'colead')),
                'a co-leader claims a project for his group');
reset role;
create table tests.claim as select id from serve_claims where opportunity_id = (select id from tests.opp);
grant select on tests.claim to authenticated;

-- ---------- Opting in ----------
select tests.login('a', 'member2');
select is(tests.n(format('select 1 from serve_claims where id = %L', (select id from tests.claim))), 1,
          'group members see their group''s project');
select lives_ok(format($$insert into serve_claim_optins (ministry_id, claim_id, profile_id) values (%L, %L, %L)$$,
                       tests.m('a'), (select id from tests.claim), tests.u('a', 'member2')),
                'a man opts in');
select throws_ok(format($$insert into serve_claim_optins (ministry_id, claim_id, profile_id) values (%L, %L, %L)$$,
                        tests.m('a'), (select id from tests.claim), tests.u('a', 'member')),
                 '42501', null, 'he cannot opt someone else in');
reset role;

select tests.login('a', 'other');
select is(tests.n(format('select 1 from serve_claims where id = %L', (select id from tests.claim))), 0,
          'another group cannot see the project');
select throws_ok(format($$insert into serve_claim_optins (ministry_id, claim_id, profile_id) values (%L, %L, %L)$$,
                        tests.m('a'), (select id from tests.claim), tests.u('a', 'other')),
                 '42501', null, 'a man from another group cannot opt in');
reset role;

-- ---------- Confirming ----------
select tests.login('a', 'member2');
select throws_ok(format($$ select confirm_group_serve(%L, array[%L]::uuid[], current_date) $$,
                        (select id from tests.claim), tests.u('a', 'member2')),
                 '42501', null, 'a member cannot confirm');
reset role;

select tests.login('a', 'leader');
select throws_ok(format($$ select confirm_group_serve(%L, array[%L]::uuid[], current_date) $$,
                        (select id from tests.claim), tests.u('a', 'other')),
                 'P0001', null, 'only men in the group can be confirmed');
select is(confirm_group_serve((select id from tests.claim), array[tests.u('a', 'member2'), tests.u('a', 'leader')], current_date),
          2, 'leader confirms two men');
select is(confirm_group_serve((select id from tests.claim), array[tests.u('a', 'member2')], current_date),
          0, 'confirming again adds nothing');
reset role;
select is((select count(*)::int from serve_logs where opportunity_id = (select id from tests.opp)), 2, 'two serve logs written');
select is((select logged_by from serve_logs where opportunity_id = (select id from tests.opp) limit 1), tests.u('a', 'leader'),
          'logged by the confirming leader');
select ok((select confirmed_at is not null from serve_claims where id = (select id from tests.claim)), 'project marked confirmed');

select tests.login('a', 'leader');
select lives_ok(format($$ delete from serve_claims where id = %L $$, (select id from tests.claim)),
                'unclaiming a confirmed project matches nothing');
reset role;
select is((select count(*)::int from serve_claims where id = (select id from tests.claim)), 1, 'a confirmed project stays');

select tests.login('a', 'member2');
select is(tests.n('select 1 from serve_logs'), 1, 'a man sees his own serve log');
reset role;

set local role anon;
select throws_ok('select 1 from serve_claims', '42501', null, 'anon cannot read projects');
reset role;

select * from finish();
rollback;
