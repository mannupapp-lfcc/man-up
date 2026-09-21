-- Shared fixture, run by scripts/test-db.mjs before every test file, inside the
-- same transaction (rolled back). Builds two complete tenants, 'a' and 'b', each
-- with a row in every table that carries ministry_id.
--
-- People per tenant (tests.u(tenant, name)):
--   admin         admin, in no group
--   leader        leader of group 1
--   colead        co-leader of group 1
--   member        member of group 1
--   member2       member of group 1 ("another man" in the same group)
--   other         member of group 2
--   other_leader  leader of group 2
--   former        left group 1 ten days ago (still in the ministry)
--   unplaced      in the ministry, in no group

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

create schema tests;
grant usage on schema tests to authenticated, anon;

create function tests.u(t text, name text) returns uuid language sql immutable as $$
  select (t || '1000000-0000-4000-8000-' || lpad(array_position(
    array['admin','leader','colead','member','member2','other','other_leader','former','unplaced'],
    name)::text, 12, '0'))::uuid
$$;
create function tests.m(t text) returns uuid language sql immutable as $$
  select (t || '0000000-0000-4000-8000-000000000002')::uuid
$$;
create function tests.g(t text, n int) returns uuid language sql immutable as $$
  select (t || '2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;

-- Act as a signed-in user for the rest of the transaction (until `reset role`).
create function tests.login(t text, name text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', tests.u(t, name), 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Row count as the current role (so RLS applies).
create function tests.n(q text) returns int language plpgsql as $$
declare c int;
begin
  execute 'select count(*) from (' || q || ') x' into c;
  return c;
end $$;

grant execute on all functions in schema tests to authenticated, anon;

do $$
declare
  t    text;
  org  uuid;
  m    uuid;
  g1   uuid;
  g2   uuid;
  mt1  uuid;
  mt2  uuid;
  pr1  uuid;
  crs  uuid;
  les  uuid;
  opp  uuid;
  gat  uuid;
  p    text;
begin
  foreach t in array array['a', 'b'] loop
    org := (t || '0000000-0000-4000-8000-000000000001')::uuid;
    m   := tests.m(t);
    g1  := tests.g(t, 1);
    g2  := tests.g(t, 2);

    insert into organizations (id, name) values (org, 'Test Org ' || t);
    insert into ministries (id, organization_id, name, ministry_key)
      values (m, org, 'Test Ministry ' || t, 'test_' || t);
    insert into ministry_config (ministry_id, key, value) values (m, 'attendance_source', '"pco"');

    foreach p in array array['admin','leader','colead','member','member2','other','other_leader','former','unplaced'] loop
      insert into auth.users (id, aud, role, email)
        values (tests.u(t, p), 'authenticated', 'authenticated', p || '.' || t || '@fixture.test');
      insert into profiles (id, organization_id, full_name, email)
        values (tests.u(t, p), org, p || ' ' || t, p || '.' || t || '@fixture.test');
      insert into ministry_members (ministry_id, profile_id, role) values (m, tests.u(t, p),
        case p when 'admin' then 'admin' when 'leader' then 'leader'
               when 'other_leader' then 'leader' when 'colead' then 'co_leader'
               else 'member' end::ministry_role);
    end loop;

    insert into invite_codes (ministry_id, code, role_granted, created_by)
      values (m, 'FIXTURE-' || upper(t), 'member', tests.u(t, 'admin'));

    insert into groups (id, ministry_id, name, status) values
      (g1, m, 'Group 1 ' || t, 'active'), (g2, m, 'Group 2 ' || t, 'active');

    insert into group_members (ministry_id, group_id, profile_id, is_group_leader, left_at) values
      (m, g1, tests.u(t, 'leader'),       true,  null),
      (m, g1, tests.u(t, 'colead'),       true,  null),
      (m, g1, tests.u(t, 'member'),       false, null),
      (m, g1, tests.u(t, 'member2'),      false, null),
      (m, g1, tests.u(t, 'former'),       false, now() - interval '10 days'),
      (m, g2, tests.u(t, 'other'),        false, null),
      (m, g2, tests.u(t, 'other_leader'), true,  null);

    -- Group 1: one marked meeting, one unmarked. Group 2: one marked.
    insert into meetings (ministry_id, group_id, meeting_at, attendance_marked_at)
      values (m, g1, now() - interval '7 days', now() - interval '7 days' + interval '2 hours')
      returning id into mt1;
    insert into meetings (ministry_id, group_id, meeting_at)
      values (m, g1, now() - interval '1 day');
    insert into meetings (ministry_id, group_id, meeting_at, attendance_marked_at)
      values (m, g2, now() - interval '5 days', now() - interval '5 days' + interval '2 hours')
      returning id into mt2;

    insert into meeting_attendance (ministry_id, meeting_id, profile_id, status, marked_by) values
      (m, mt1, tests.u(t, 'leader'),  'present', tests.u(t, 'leader')),
      (m, mt1, tests.u(t, 'colead'),  'present', tests.u(t, 'leader')),
      (m, mt1, tests.u(t, 'member'),  'present', tests.u(t, 'leader')),
      (m, mt1, tests.u(t, 'member2'), 'absent',  tests.u(t, 'leader')),
      (m, mt2, tests.u(t, 'other'),   'present', tests.u(t, 'other_leader'));

    insert into gatherings (ministry_id, title, gathering_at, pco_event_id)
      values (m, 'Gathering ' || t, now() - interval '3 days', t || '-evt-1')
      returning id into gat;
    insert into gathering_checkins (ministry_id, gathering_id, profile_id)
      values (m, gat, tests.u(t, 'member'));

    insert into pco_roster (ministry_id, pco_person_id, full_name)
      values (m, t || '-pco-1', 'member ' || t);
    insert into pco_gathering_attendance (ministry_id, pco_person_id, pco_event_id, event_at)
      values (m, t || '-pco-1', t || '-evt-1', now() - interval '3 days');
    insert into pco_sync_log (ministry_id, resource, rows_upserted, status)
      values (m, 'roster', 1, 'ok');
    insert into pco_match_log (ministry_id, profile_id, pco_person_id, action, performed_by)
      values (m, tests.u(t, 'member'), t || '-pco-1', 'matched', tests.u(t, 'admin'));

    insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous)
      values (m, g1, tests.u(t, 'member'), 'member prayer ' || t, false)
      returning id into pr1;
    insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous)
      values (m, g1, tests.u(t, 'member2'), 'anonymous prayer ' || t, true);
    insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous)
      values (m, g2, tests.u(t, 'other'), 'group 2 prayer ' || t, false);
    insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind)
      values (m, pr1, tests.u(t, 'member2'), 'prayed');

    insert into group_messages (ministry_id, group_id, profile_id, body) values
      (m, g1, tests.u(t, 'member'), 'group 1 message ' || t),
      (m, g2, tests.u(t, 'other'),  'group 2 message ' || t);

    insert into courses (ministry_id, sanity_id, title, is_published)
      values (m, t || '-course-1', 'Published ' || t, true) returning id into crs;
    insert into courses (ministry_id, sanity_id, title, is_published)
      values (m, t || '-course-2', 'Draft ' || t, false);
    insert into lessons (ministry_id, course_id, sanity_id, title, sort_order)
      values (m, crs, t || '-lesson-1', 'Lesson ' || t, 1) returning id into les;
    insert into lesson_progress (ministry_id, lesson_id, profile_id, completed_at, reflection) values
      (m, les, tests.u(t, 'member'),  now(), 'member reflection ' || t),
      (m, les, tests.u(t, 'member2'), now(), 'member2 reflection ' || t);

    insert into serve_opportunities (ministry_id, title) values (m, 'Serve ' || t)
      returning id into opp;
    insert into serve_logs (ministry_id, opportunity_id, profile_id, served_at, logged_by)
      values (m, opp, tests.u(t, 'member'), current_date, tests.u(t, 'leader'));

    insert into contact_logs (ministry_id, profile_id, leader_id, method, note) values
      (m, tests.u(t, 'member'), tests.u(t, 'leader'),       'call', 'note about member ' || t),
      (m, tests.u(t, 'other'),  tests.u(t, 'other_leader'), 'text', 'note about other ' || t);

    insert into score_config (ministry_id, key, value) values (m, 'test_weight', 1);
    insert into member_scores (ministry_id, profile_id, as_of, total, tier, components) values
      (m, tests.u(t, 'member'), current_date, 80, 'Thriving', '{}'),
      (m, tests.u(t, 'other'),  current_date, 40, 'Drifting', '{}');
    insert into leader_scores (ministry_id, profile_id, as_of, total, components)
      values (m, tests.u(t, 'leader'), current_date, 90, '{}');

    insert into push_tokens (profile_id, ministry_id, expo_token)
      values (tests.u(t, 'member'), m, 'ExponentPushToken[' || t || ']');

    if to_regclass('public.serve_claims') is not null then
      execute format($q$insert into serve_claims (ministry_id, group_id, opportunity_id, claimed_by)
                        values (%L, %L, %L, %L)$q$, m, g1, opp, tests.u(t, 'leader'));
      execute format($q$insert into serve_claim_optins (ministry_id, claim_id, profile_id)
                        select %L, id, %L from serve_claims where group_id = %L$q$, m, tests.u(t, 'member'), g1);
    end if;

    if to_regclass('public.gathering_content') is not null then
      execute format($q$insert into gathering_content (ministry_id, sanity_id, gathering_date, topic)
                        values (%L, %L, current_date, 'Topic')$q$, m, t || '-gc-1');
      execute format($q$insert into weekly_questions (ministry_id, sanity_id, week_of, questions)
                        values (%L, %L, date_trunc('week', current_date)::date, '["Q1"]')$q$, m, t || '-wq-1');
    end if;

    -- Blocks and reports exist only if 0007 is applied (tests run before and after).
    if to_regclass('public.user_blocks') is not null then
      -- 'unplaced' blocks 'former': neither has content, so no other test changes.
      execute format('insert into user_blocks (ministry_id, blocker_id, blocked_id) values (%L, %L, %L)',
                     m, tests.u(t, 'unplaced'), tests.u(t, 'former'));
      -- Already reviewed, so it grants admins no access (only open reports do).
      execute format($q$insert into content_reports (ministry_id, reporter_id, target_type, target_id, status)
                        select %L, %L, 'group_message', id, 'reviewed' from group_messages
                        where ministry_id = %L and group_id = %L$q$, m, tests.u(t, 'member2'), m, g1);
    end if;
  end loop;
end $$;
