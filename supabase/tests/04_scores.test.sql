-- (d) Members cannot read member_scores or leader_scores (Non-negotiable 5).
-- Leaders read their own group's member scores only; leader scores are admin-only.
begin;
select no_plan();

create function tests.no_scores(who text) returns setof text language plpgsql as $$
begin
  return next is(tests.n('select 1 from member_scores'), 0, who || ' cannot read member_scores');
  return next is(tests.n('select 1 from leader_scores'), 0, who || ' cannot read leader_scores');
  return next is(tests.n('select 1 from score_config'),  0, who || ' cannot read score_config');
end $$;
grant execute on function tests.no_scores(text) to authenticated;

-- 'member' and 'other' each have a score row of their own; still invisible.
select tests.login('a', 'member');   select tests.no_scores('member (own score exists)'); reset role;
select tests.login('a', 'member2');  select tests.no_scores('member2');                   reset role;
select tests.login('a', 'other');    select tests.no_scores('other (own score exists)');  reset role;
select tests.login('a', 'former');   select tests.no_scores('former');                    reset role;
select tests.login('a', 'unplaced'); select tests.no_scores('unplaced');                  reset role;

select tests.login('a', 'member');
select throws_ok(
  format($$insert into member_scores (ministry_id, profile_id, as_of, total, tier, components)
           values (%L, %L, current_date + 1, 100, 'Thriving', '{}')$$, tests.m('a'), tests.u('a', 'member')),
  '42501', null, 'member cannot write his own score');
reset role;

select tests.login('a', 'leader');
select is(tests.n('select 1 from member_scores'), 1, 'leader reads member scores for his group only');
select is(tests.n('select 1 from leader_scores'), 0, 'leader cannot read leader scores, even his own');
select is(tests.n('select 1 from score_config'), 0, 'leader cannot read score_config');
reset role;

select tests.login('a', 'colead');
select is(tests.n('select 1 from member_scores'), 1, 'co-leader reads member scores for his group only');
reset role;

select tests.login('a', 'other_leader');
select is(tests.n(format('select 1 from member_scores where profile_id = %L', tests.u('a', 'member'))),
          0, 'group 2 leader cannot read group 1 scores');
reset role;

select tests.login('a', 'admin');
select is(tests.n('select 1 from member_scores'), 2, 'admin reads all member scores in his ministry');
select is(tests.n('select 1 from leader_scores'), 1, 'admin reads leader scores');
select is(tests.n('select 1 from score_config'), 1, 'admin reads score_config');
reset role;

select * from finish();
rollback;
