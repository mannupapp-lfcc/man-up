-- ============================================================
-- DEV seed data for lfcc-manup. Fictional people only. NOT for launch.
-- Run:    pnpm db:seed     (runs dev_unseed.sql first, so it is safe to re-run)
-- Remove: pnpm db:unseed   (must be run before real launch)
--
-- Markers (dev_unseed.sql relies on these, keep them):
--   every seed uuid starts with 5eed; PCO and Sanity ids start with 'seed-'.
-- Every seed login uses password: manup-dev-password
--
-- Scenario coverage:
--   Tuesday Morning Group: leader Marcus, co-leader Andre, 5 men. Byron has
--     missed the last 3 meetings (velocity flag case).
--   Thursday Night Group: leader Darnell, co-leader Terrence, 4 men. Most recent
--     meeting is left unmarked (attendance prompt / 72-hour gate case).
--   Young Men's Group: forming, 1 man, no leader yet.
--   Dwayne and Tyrone joined 20 days ago and have no group (placement nudge case).
--   PCO: men 02-10 matched by admin; 11-14 on the PCO roster but unmatched
--     (Match queue; 13-14 have different contact info in PCO); 3 PCO people never
--     joined the app; 15-17 and the admin are not in PCO at all.
--   Pray: group-only requests in both groups (one anonymous), and one ministry-wide
--     request from Dwayne, who has no group yet.
-- Scores are not seeded; the Sunday night scoring job computes them.
-- ============================================================

do $$
declare
  m      constant uuid := '00000000-0000-0000-0000-000000000002';  -- Man Up
  org    constant uuid := '00000000-0000-0000-0000-000000000001';  -- LFCC
  pw     text := extensions.crypt('manup-dev-password', extensions.gen_salt('bf'));
  admin  constant uuid := '5eed0001-0000-4000-8000-000000000001';
  grp_a  constant uuid := '5eed0002-0000-4000-8000-000000000001';
  grp_b  constant uuid := '5eed0002-0000-4000-8000-000000000002';
  grp_c  constant uuid := '5eed0002-0000-4000-8000-000000000003';
  course constant uuid := '5eed0004-0000-4000-8000-000000000001';
  -- Start of the current week (Monday 00:00 local).
  week0  timestamptz := date_trunc('week', now() at time zone 'America/New_York')
                        at time zone 'America/New_York';
  u      record;
  mt     record;
  g      record;
  pr     uuid;
  i      int;
begin
  -- ---------- People ----------
  create temp table _people (n int, name text, role ministry_role, grp uuid,
                             leads boolean, joined_days int) on commit drop;
  insert into _people values
    ( 1, 'Dev Admin',        'admin',     null,  false, 120),
    ( 2, 'Marcus Reed',      'leader',    grp_a, true,  110),
    ( 3, 'Darnell Brooks',   'leader',    grp_b, true,  110),
    ( 4, 'Andre Coleman',    'co_leader', grp_a, true,  100),
    ( 5, 'Terrence Hayes',   'co_leader', grp_b, true,  100),
    ( 6, 'Jerome Walker',    'member',    grp_a, false,  90),
    ( 7, 'Calvin Price',     'member',    grp_a, false,  90),
    ( 8, 'Isaiah Grant',     'member',    grp_a, false,  80),
    ( 9, 'Victor Lewis',     'member',    grp_a, false,  75),
    (10, 'Byron Mitchell',   'member',    grp_a, false,  70),
    (11, 'Reginald Scott',   'member',    grp_b, false,  85),
    (12, 'Omar Jenkins',     'member',    grp_b, false,  80),
    (13, 'Curtis Bell',      'member',    grp_b, false,  60),
    (14, 'Leon Foster',      'member',    grp_b, false,  50),
    (15, 'Malik Turner',     'member',    grp_c, false,   5),
    (16, 'Dwayne Harris',    'member',    null,  false,  20),
    (17, 'Tyrone Ellis',     'member',    null,  false,  20);

  alter table _people add column id uuid, add column email text, add column phone text;
  update _people set
    id    = ('5eed0001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    email = case when n = 1 then 'admin@manup.test'
                 else lower(replace(name, ' ', '.')) || '@manup.test' end,
    phone = '+1555010' || lpad(n::text, 4, '0');

  for u in select * from _people order by n loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      u.email, pw, now(), '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', u.name), now(), now(), '', '', '', '');

    insert into auth.identities (provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at)
    values (u.id::text, u.id,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      'email', now(), now(), now());

    insert into profiles (id, organization_id, full_name, phone, email, created_at)
    values (u.id, org, u.name, u.phone, u.email, now() - make_interval(days => u.joined_days));

    insert into ministry_members (ministry_id, profile_id, role, role_since, joined_at)
    values (m, u.id, u.role, (now() - make_interval(days => u.joined_days))::date,
            now() - make_interval(days => u.joined_days));
  end loop;

  -- ---------- Groups ----------
  insert into groups (id, ministry_id, name, status, meeting_day, meeting_time, created_at) values
    (grp_a, m, 'Tuesday Morning Group', 'active',  'Tuesday',  '07:00', now() - interval '110 days'),
    (grp_b, m, 'Thursday Night Group',  'active',  'Thursday', '19:00', now() - interval '110 days'),
    (grp_c, m, 'Young Men''s Group',    'forming', 'Saturday', '11:30', now() - interval '6 days');

  insert into group_members (ministry_id, group_id, profile_id, is_group_leader, joined_at)
  select m, grp, id, leads, now() - make_interval(days => joined_days)
  from _people where grp is not null;

  -- ---------- Meetings: 6 past weeks + next week, per active group ----------
  -- Tuesday 7:00 am and Thursday 7:00 pm local.
  for g in select * from (values (grp_a, interval '1 day 7 hours'),
                                 (grp_b, interval '3 days 19 hours')) v(id, offs) loop
    for i in -6..1 loop
      insert into meetings (ministry_id, group_id, meeting_at, attendance_marked_at)
      values (m, g.id, week0 + g.offs + make_interval(weeks => i), null);
    end loop;
  end loop;

  -- Mark past meetings (3 hours after start), except the most recent Thursday one.
  update meetings set attendance_marked_at = meeting_at + interval '3 hours'
  where group_id in (grp_a, grp_b) and meeting_at < now() - interval '3 hours'
    and id <> coalesce((select id from meetings
                        where group_id = grp_b and meeting_at < now()
                        order by meeting_at desc limit 1),
                       '00000000-0000-0000-0000-000000000000');

  for mt in select * from meetings
            where group_id in (grp_a, grp_b) and attendance_marked_at is not null loop
    insert into meeting_attendance (ministry_id, meeting_id, profile_id, status, marked_by, marked_at)
    select m, mt.id, p.id,
      case
        -- Byron (10) has missed the three most recent Tuesdays.
        when p.n = 10 and mt.meeting_at > now() - interval '21 days' then 'absent'::attendance_status
        when p.leads then 'present'
        when abs(hashtext(p.n::text || mt.meeting_at::text)) % 10 < 8 then 'present'
        when abs(hashtext(p.n::text || mt.meeting_at::text)) % 10 = 8 then 'excused'
        else 'absent'
      end,
      (select id from _people where grp = mt.group_id and role = 'leader'),
      mt.attendance_marked_at
    from _people p
    where p.grp = mt.group_id
      and mt.meeting_at > now() - make_interval(days => p.joined_days);
  end loop;

  -- ---------- Saturday gatherings: 4 past + 4 upcoming, 9:00 am local ----------
  for i in -4..3 loop
    insert into gatherings (id, ministry_id, title, gathering_at, church_center_url, pco_event_id)
    values (('5eed0003-0000-4000-8000-' || lpad((i + 5)::text, 12, '0'))::uuid, m,
            'Man Up Saturday Gathering',
            week0 + interval '5 days 9 hours' + make_interval(weeks => i),
            'https://lfcc.churchcenter.com/registrations',
            'seed-evt-' || (i + 5));
  end loop;

  -- ---------- PCO read mirror ----------
  insert into pco_roster (ministry_id, pco_person_id, full_name, email, phone, synced_at)
  select m, 'seed-pco-' || lpad(n::text, 2, '0'), name,
    case when n in (13, 14) then lower(split_part(name, ' ', 1)) || '.personal@manup.test' else email end,
    case when n in (13, 14) then null else phone end,
    now() - interval '6 hours'
  from _people where n between 2 and 14;

  insert into pco_roster (ministry_id, pco_person_id, full_name, email, phone, synced_at) values
    (m, 'seed-pco-90', 'Harold Simmons', 'harold.simmons@manup.test', '+15550100090', now() - interval '6 hours'),
    (m, 'seed-pco-91', 'Kenneth Ward',   null,                        '+15550100091', now() - interval '6 hours'),
    (m, 'seed-pco-92', 'Samuel Ortiz',   'samuel.ortiz@manup.test',   null,           now() - interval '6 hours');

  -- Admin-confirmed matches for men 02-10 (simulates the PCO Match queue).
  update profiles p set pco_person_id = 'seed-pco-' || lpad(x.n::text, 2, '0')
  from _people x where x.id = p.id and x.n between 2 and 10;

  insert into pco_match_log (ministry_id, profile_id, pco_person_id, action, performed_by, performed_at)
  select m, id, 'seed-pco-' || lpad(n::text, 2, '0'), 'matched', admin, now() - interval '30 days'
  from _people where n between 2 and 10;

  insert into pco_gathering_attendance (ministry_id, pco_person_id, pco_event_id, event_at, synced_at)
  select m, r.pco_person_id, ga.pco_event_id, ga.gathering_at, now() - interval '6 hours'
  from pco_roster r
  cross join gatherings ga
  where r.ministry_id = m and r.pco_person_id like 'seed-%'
    and ga.id::text like '5eed%' and ga.gathering_at < now()
    and abs(hashtext(r.pco_person_id || ga.pco_event_id)) % 4 <> 0;

  insert into pco_sync_log (id, ministry_id, resource, rows_upserted, status, ran_at) values
    ('5eed0008-0000-4000-8000-000000000001', m, 'roster', 16, 'ok', now() - interval '6 hours'),
    ('5eed0008-0000-4000-8000-000000000002', m, 'gathering_attendance',
     (select count(*) from pco_gathering_attendance where pco_person_id like 'seed-%'), 'ok',
     now() - interval '6 hours');

  -- ---------- Pray ----------
  insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, status, created_at)
  values (m, grp_a, (select id from _people where n = 6),
          'Pray for my mother''s surgery on Thursday.', false, 'answered', now() - interval '12 days')
  returning id into pr;
  insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, body, created_at)
  select m, pr, id, 'prayed', null, now() - interval '11 days' from _people where n in (2, 4, 7, 8, 11);
  insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, body, created_at)
  values (m, pr, (select id from _people where n = 6), 'comment',
          'Surgery went well. She is home and recovering. Thank you, brothers.', now() - interval '8 days');

  insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, status, created_at)
  values (m, grp_b, (select id from _people where n = 11),
          'Job interview next week. Pray for peace and favor.', false, 'open', now() - interval '3 days')
  returning id into pr;
  insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, created_at)
  select m, pr, id, 'prayed', now() - interval '2 days' from _people where n in (3, 5, 12);

  insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, status, created_at)
  values (m, grp_b, (select id from _people where n = 13),
          'Struggling in my marriage right now. Please pray.', true, 'open', now() - interval '1 day');

  -- Ministry-wide: Dwayne has no group yet and shared with everyone.
  insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, visibility, created_at)
  values (m, null, (select id from _people where n = 16),
          'New here. Pray that I find my footing and a group of brothers.', false, 'ministry', now() - interval '2 days')
  returning id into pr;
  insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, created_at)
  select m, pr, id, 'prayed', now() - interval '1 day' from _people where n in (1, 2, 3, 9, 12);

  -- ---------- Group chat ----------
  insert into group_messages (ministry_id, group_id, profile_id, body, created_at) values
    (m, grp_a, (select id from _people where n = 2), 'Good word this morning, men. See you Tuesday.', now() - interval '5 days'),
    (m, grp_a, (select id from _people where n = 7), 'Amen. Bringing coffee next week.',              now() - interval '5 days' + interval '20 minutes'),
    (m, grp_a, (select id from _people where n = 4), 'Byron, we missed you. Hope all is well.',       now() - interval '2 days'),
    (m, grp_b, (select id from _people where n = 3), 'Reminder: we start at 7 sharp Thursday.',       now() - interval '4 days'),
    (m, grp_b, (select id from _people where n = 12), 'I''ll be a few minutes late, save me a seat.',  now() - interval '1 day');

  -- ---------- Courses (normally synced from Sanity) ----------
  insert into courses (id, ministry_id, sanity_id, title, is_published)
  values (course, m, 'seed-course-stepping-up', 'Stepping Up', true);

  insert into lessons (id, ministry_id, course_id, sanity_id, title, sort_order)
  select ('5eed0005-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, m, course,
         'seed-lesson-' || n, t, n
  from (values (1, 'Called to Stand'), (2, 'Integrity When No One Is Watching'),
               (3, 'Leading at Home'), (4, 'Brothers in Arms')) l(n, t);

  insert into lesson_progress (ministry_id, lesson_id, profile_id, completed_at, reflection)
  select m, ('5eed0005-0000-4000-8000-' || lpad(l::text, 12, '0'))::uuid, p.id,
         now() - make_interval(days => 20 - l * 4),
         case when p.n = 6 and l = 1 then 'I have been standing on the sidelines too long.' end
  from _people p cross join generate_series(1, 4) l
  where (p.n in (2, 4, 6, 7) and l <= 3) or (p.n in (11, 12) and l = 1);

  -- ---------- Serve ----------
  insert into serve_opportunities (id, ministry_id, title, serve_at, church_center_url) values
    ('5eed0006-0000-4000-8000-000000000001', m, 'Parking Team',            week0 + interval '6 days 8 hours',  'https://lfcc.churchcenter.com/registrations'),
    ('5eed0006-0000-4000-8000-000000000002', m, 'Community Food Pantry',   week0 + interval '12 days 10 hours', 'https://lfcc.churchcenter.com/registrations'),
    ('5eed0006-0000-4000-8000-000000000003', m, 'Men''s Breakfast Setup',  week0 - interval '2 days',          'https://lfcc.churchcenter.com/registrations');

  insert into serve_logs (ministry_id, opportunity_id, profile_id, served_at, logged_by)
  select m, '5eed0006-0000-4000-8000-000000000003', id, (week0 - interval '2 days')::date,
         (select id from _people where n = 2)
  from _people where n in (2, 6, 7, 11);

  -- ---------- Shepherding contacts (leaders only) ----------
  insert into contact_logs (ministry_id, profile_id, leader_id, contacted_at, method, note) values
    (m, (select id from _people where n = 10), (select id from _people where n = 2),
     now() - interval '3 days', 'call', 'Left a voicemail. Will try again Friday.'),
    (m, (select id from _people where n = 13), (select id from _people where n = 3),
     now() - interval '1 day', 'text', 'Checked in after his prayer request. Meeting for coffee Saturday.');

  -- ---------- Invite codes ----------
  insert into invite_codes (id, ministry_id, code, role_granted, max_uses, created_by) values
    ('5eed0007-0000-4000-8000-000000000001', m, 'SEED-MEMBER', 'member',    50, admin),
    ('5eed0007-0000-4000-8000-000000000002', m, 'SEED-COLEAD', 'co_leader',  5, admin);
end $$;
