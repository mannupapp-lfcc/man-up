-- Signup: open signup joins as a member of an open ministry; invite codes grant
-- leader roles (and can promote an existing member). Nothing else creates a
-- profile or a membership.
begin;
select no_plan();

-- Tenant A takes open signups; tenant B does not.
insert into ministry_config (ministry_id, key, value) values (tests.m('a'), 'open_signup', 'true');

-- Brand-new signed-up users with no profile yet.
insert into auth.users (id, aud, role, email) values
  ('a9000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'new1@fixture.test'),
  ('a9000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'new2@fixture.test'),
  ('a9000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'new3@fixture.test');

insert into invite_codes (ministry_id, code, role_granted, max_uses) values
  (tests.m('a'), 'COLEAD-A', 'co_leader', 1),
  (tests.m('a'), 'EXPIRED-A', 'member', null),
  (tests.m('b'), 'LEADER-B', 'leader', null);
update invite_codes set expires_at = now() - interval '1 day' where code = 'EXPIRED-A';
insert into invite_codes (ministry_id, code, role_granted, revoked_at)
  values (tests.m('a'), 'REVOKED-A', 'leader', now());

create function tests.login_new(n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object(
    'sub', ('a9000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
grant execute on function tests.login_new(int) to authenticated;

create function tests.role_of(p uuid, m uuid) returns text language sql as $$
  select role::text from ministry_members where profile_id = p and ministry_id = m
$$;

-- ---------- Signed out ----------
set local role anon;
select ok(exists (select 1 from list_open_ministries() where ministry_id = tests.m('a')),
          'anon sees an open ministry');
select ok(not exists (select 1 from list_open_ministries() where ministry_id = tests.m('b')),
          'anon does not see a ministry without open_signup');
select results_eq($$ select ministry_name, role::text from check_invite(' colead-a ') $$,
                  $$ values ('Test Ministry a', 'co_leader') $$,
                  'anon can check a code (trimmed, any case)');
select is_empty($$ select * from check_invite('EXPIRED-A') $$, 'expired code is not valid');
select is_empty($$ select * from check_invite('REVOKED-A') $$, 'revoked code is not valid');
select is_empty($$ select * from check_invite('NOPE') $$, 'unknown code is not valid');
select throws_ok(format($$ select join_ministry(%L, 'Anon') $$, tests.m('a')), '42501', null,
                 'anon cannot join');
select throws_ok($$ select redeem_invite('COLEAD-A', 'Anon') $$, '42501', null, 'anon cannot redeem');
select throws_ok('select 1 from invite_codes', '42501', null, 'anon cannot read invite_codes');
reset role;

-- ---------- Open signup ----------
select tests.login_new(1);
select throws_ok(format($$ select join_ministry(%L, '   ') $$, tests.m('a')), '22023', null,
                 'name is required for a new profile');
select is(join_ministry(tests.m('a'), 'New One', '555-0101'), tests.m('a'), 'new man joins an open ministry');
select is((select role::text from ministry_members where profile_id = auth.uid()), 'member',
          'open signup always gives member');
select is((select full_name from profiles where id = auth.uid()), 'New One', 'profile has his name');
select is(join_ministry(tests.m('a'), 'Different Name'), tests.m('a'), 'joining again is harmless');
select is((select full_name from profiles where id = auth.uid()), 'New One',
          'joining again does not overwrite his profile');
select throws_ok(format($$ select join_ministry(%L, 'New One') $$, tests.m('b')), 'P0001', null,
                 'cannot join a ministry that is not open');
select is(tests.n('select 1 from group_messages'), 0, 'a new member reads no chat until placed in a group');
select is(tests.n('select 1 from prayer_requests'), 0, 'a new member reads no prayer until placed');
select ok(tests.n('select 1 from gatherings') > 0, 'a new member sees gatherings');
reset role;
select is((select email from profiles where id = 'a9000000-0000-4000-8000-000000000001'),
          'new1@fixture.test', 'profile email comes from his auth account');

-- ---------- Codes: promote an existing member, never demote ----------
select tests.login_new(1);
select is(redeem_invite('COLEAD-A'), tests.m('a'), 'existing member redeems a co-leader code');
reset role;
select is(tests.role_of('a9000000-0000-4000-8000-000000000001', tests.m('a')), 'co_leader',
          'the code promoted him');
select is((select uses from invite_codes where code = 'COLEAD-A'), 1, 'the promotion counted a use');

select tests.login('a', 'leader');
select lives_ok($$ select redeem_invite('FIXTURE-A') $$, 'a leader redeems a member code');
reset role;
select is(tests.role_of(tests.u('a', 'leader'), tests.m('a')), 'leader', 'a code never lowers a role');
select is((select uses from invite_codes where code = 'FIXTURE-A'), 0, 'no use counted when nothing changed');

-- ---------- Codes: new man joins with a leader role ----------
select tests.login_new(2);
select throws_ok($$ select redeem_invite('COLEAD-A', 'New Two') $$, 'P0001', null,
                 'a code at max_uses cannot be redeemed');
select is_empty($$ select * from check_invite('COLEAD-A') $$, 'a used-up code no longer checks as valid');
select throws_ok($$ select redeem_invite('REVOKED-A', 'New Two') $$, 'P0001', null,
                 'a revoked code cannot be redeemed');
select is(redeem_invite('LEADER-B', 'New Two'), tests.m('b'),
          'a code joins a ministry even when it has no open signup');
reset role;
select is(tests.role_of('a9000000-0000-4000-8000-000000000002', tests.m('b')), 'leader',
          'he gets the role on the code');

-- ---------- Tenancy and removal ----------
select tests.login('a', 'member');
select throws_ok($$ select redeem_invite('LEADER-B') $$, 'P0001', null,
                 'a man in church A cannot join a ministry in church B by code');
reset role;
select is(tests.role_of(tests.u('a', 'member'), tests.m('b')), null, 'no cross-church membership');

update ministry_members set left_at = now() where profile_id = tests.u('a', 'unplaced');
select tests.login('a', 'unplaced');
select throws_ok(format($$ select join_ministry(%L, 'x') $$, tests.m('a')), 'P0001', null,
                 'a removed man cannot rejoin through open signup');
select throws_ok($$ select redeem_invite('FIXTURE-A') $$, 'P0001', null,
                 'a removed man cannot rejoin with a code');
reset role;

-- ---------- The only doors are the functions above ----------
select tests.login_new(3);
select throws_ok(
  format($$ select fn_ensure_membership(%L, 'admin', 'Sneaky', null) $$, tests.m('a')),
  '42501', null, 'the internal membership function cannot be called by clients');
select throws_ok(
  format($$insert into ministry_members (ministry_id, profile_id, role) values (%L, auth.uid(), 'admin')$$,
         tests.m('a')),
  '42501', null, 'a signed-up man cannot insert his own membership');
select throws_ok(
  $$insert into profiles (id, organization_id, full_name)
    values (auth.uid(), 'a0000000-0000-4000-8000-000000000001', 'x')$$,
  '42501', null, 'a signed-up man cannot insert his own profile');
reset role;

select * from finish();
rollback;
