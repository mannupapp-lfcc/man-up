-- Every table in public has RLS enabled. A table without it is readable by any
-- signed-in user, so this guards every future migration too.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(2);

select ok(
  (select count(*) from pg_tables where schemaname = 'public') > 0,
  'public schema has tables'
);

select is(
  array(
    select tablename::text from pg_tables
    where schemaname = 'public' and not rowsecurity
    order by 1
  ),
  array[]::text[],
  'RLS is enabled on every public table'
);

select * from finish();
rollback;
