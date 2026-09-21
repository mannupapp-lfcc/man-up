-- (a) A member of ministry A cannot read any ministry B row on any table,
-- whatever his role in A.
begin;
select no_plan();

-- Every table with ministry_id, captured as postgres (information_schema hides
-- tables the caller has no privileges on, which would silently shrink the test).
create table tests.tenant_tables as
  select c.table_name::text as name
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public' and c.column_name = 'ministry_id'
    and t.table_type = 'BASE TABLE';
grant select on tests.tenant_tables to authenticated;

-- Guards: the fixture must cover every tenant table, and only known tables may
-- lack ministry_id. A new table fails here until the fixture and policies cover it.
select is_empty(
  $$ select name from tests.tenant_tables
     where tests.n(format('select 1 from public.%I where ministry_id = %L',
                          name, tests.m('b'))) = 0 $$,
  'fixture has ministry B rows in every table with ministry_id');

select is(
  array(select t.table_name::text collate "C" from information_schema.tables t
        where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
          and not exists (select 1 from information_schema.columns c
                          where c.table_schema = 'public' and c.table_name = t.table_name
                            and c.column_name = 'ministry_id')
        order by 1),
  array['ministries', 'organizations', 'profiles', 'sanity_sync_log']::text[],
  'only known tables lack ministry_id');

-- One assertion per tenant table for the current user.
create function tests.no_b_rows(who text) returns setof text language plpgsql as $$
declare r record;
begin
  for r in select name from tests.tenant_tables order by name loop
    return next is(
      tests.n(format('select 1 from public.%I where ministry_id = %L', r.name, tests.m('b'))),
      0, format('%s in A reads no ministry B rows in %s', who, r.name));
  end loop;
  return next is(tests.n(format('select 1 from ministries where id = %L', tests.m('b'))),
                 0, who || ' in A cannot see ministry B');
  return next is(tests.n(format('select 1 from organizations where id = %L',
                                'b0000000-0000-4000-8000-000000000001')),
                 0, who || ' in A cannot see organization B');
  return next is(tests.n($q$select 1 from profiles where id::text like 'b%'$q$),
                 0, who || ' in A cannot see any ministry B profile');
  return next is(tests.n($q$select 1 from sanity_sync_log$q$),
                 0, who || ' cannot read sanity_sync_log');
end $$;
grant execute on function tests.no_b_rows(text) to authenticated;

select tests.login('a', 'admin');        select tests.no_b_rows('admin');        reset role;
select tests.login('a', 'leader');       select tests.no_b_rows('leader');       reset role;
select tests.login('a', 'colead');       select tests.no_b_rows('co-leader');    reset role;
select tests.login('a', 'member');       select tests.no_b_rows('member');       reset role;
select tests.login('a', 'member2');      select tests.no_b_rows('member2');      reset role;
select tests.login('a', 'other');        select tests.no_b_rows('other');        reset role;
select tests.login('a', 'other_leader'); select tests.no_b_rows('other_leader'); reset role;
select tests.login('a', 'former');       select tests.no_b_rows('former');       reset role;
select tests.login('a', 'unplaced');     select tests.no_b_rows('unplaced');     reset role;

-- Sanity: the wall is not just "everything empty". A's member sees his own ministry.
select tests.login('a', 'member');
select is(tests.n('select 1 from ministries'), 1, 'member sees exactly his own ministry');
select is(tests.n('select 1 from organizations'), 1, 'member sees exactly his own organization');
select ok(tests.n('select 1 from gatherings') > 0, 'member sees his ministry gatherings');
reset role;

-- Writes cannot target another ministry either.
select tests.login('a', 'admin');
select throws_ok(
  format($$insert into groups (ministry_id, name) values (%L, 'intruder')$$, tests.m('b')),
  '42501', null, 'admin of A cannot create a group in ministry B');
select throws_ok(
  format($$insert into ministry_members (ministry_id, profile_id, role)
           values (%L, %L, 'admin')$$, tests.m('b'), tests.u('a', 'admin')),
  '42501', null, 'admin of A cannot make himself a member of ministry B');
reset role;

select * from finish();
rollback;
