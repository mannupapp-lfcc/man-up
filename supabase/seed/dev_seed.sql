-- ============================================================
-- DEV seed data for lfcc-manup. Fictional people only. NOT for launch.
-- Run:    pnpm db:seed     (runs dev_unseed.sql first, so it is safe to re-run)
-- Remove: pnpm db:unseed   (must be run before real launch)
--
-- Markers (dev_unseed.sql relies on these, keep them):
--   every seed uuid starts with 5eed; PCO and Sanity ids start with 'seed-'.
-- Every seed login uses password: password
-- Emails: <firstname>@manup.test, and admin@manup.test for Nathan (the admin).
--
-- What each account shows:
--   Nathan    admin: Health, Reports (1 open), Planning Center Match queue, Scoring
--   Marcus    leader, Tuesday Morning: Byron on Needs a Call (3-week decline), a
--             confirmed group serve project, contact history
--   Andre     co-leader, Tuesday Morning: same leader tools as Marcus
--   Jerome    member, Tuesday: answered prayer, lesson reflection, opted in to serve
--   Calvin, Isaiah, Victor, Byron   Tuesday members (Byron is drifting)
--   Darnell   leader, Thursday Night: an unmarked meeting to mark, Curtis on a
--             season-of-life flag, an anonymous prayer in his group
--   Terrence  co-leader, Thursday Night
--   Reginald, Omar, Curtis, Leon    Thursday members (Leon wrote a reported message)
--   Malik     Young Men's Group (forming, joined 5 days ago: shows as New)
--   Dwayne    not in a group; shared a ministry-wide prayer request
--   Tyrone    not in a group; has blocked Dwayne (so Dwayne's post is hidden for him)
-- ============================================================

do $$
declare
  m      constant uuid := '00000000-0000-0000-0000-000000000002';  -- Man Up
  org    constant uuid := '00000000-0000-0000-0000-000000000001';  -- LFCC
  pw     text := extensions.crypt('password', extensions.gen_salt('bf'));
  grp_a  constant uuid := '5eed0002-0000-4000-8000-000000000001';
  grp_b  constant uuid := '5eed0002-0000-4000-8000-000000000002';
  grp_c  constant uuid := '5eed0002-0000-4000-8000-000000000003';
  course constant uuid := '5eed0004-0000-4000-8000-000000000001';
  opp_pantry    constant uuid := '5eed0006-0000-4000-8000-000000000001';
  opp_breakfast constant uuid := '5eed0006-0000-4000-8000-000000000002';
  opp_parking   constant uuid := '5eed0006-0000-4000-8000-000000000003';
  -- Start of the current week (Monday 00:00 local).
  week0  timestamptz := date_trunc('week', now() at time zone 'America/New_York')
                        at time zone 'America/New_York';
  last_sunday date := (date_trunc('week', now() at time zone 'America/New_York'))::date - 1;
  u      record;
  mt     record;
  g      record;
  pr     uuid;
  claim  uuid;
  i      int;
begin
  -- ---------- People ----------
  create temp table _people (n int, name text, role ministry_role, grp uuid,
                             leads boolean, joined_days int) on commit drop;
  insert into _people values
    ( 1, 'Nathan',   'admin',     null,  false, 120),
    ( 2, 'Marcus',   'leader',    grp_a, true,  110),
    ( 3, 'Darnell',  'leader',    grp_b, true,  110),
    ( 4, 'Andre',    'co_leader', grp_a, true,  100),
    ( 5, 'Terrence', 'co_leader', grp_b, true,  100),
    ( 6, 'Jerome',   'member',    grp_a, false,  90),
    ( 7, 'Calvin',   'member',    grp_a, false,  90),
    ( 8, 'Isaiah',   'member',    grp_a, false,  80),
    ( 9, 'Victor',   'member',    grp_a, false,  75),
    (10, 'Byron',    'member',    grp_a, false,  70),
    (11, 'Reginald', 'member',    grp_b, false,  85),
    (12, 'Omar',     'member',    grp_b, false,  80),
    (13, 'Curtis',   'member',    grp_b, false,  60),
    (14, 'Leon',     'member',    grp_b, false,  50),
    (15, 'Malik',    'member',    grp_c, false,   5),
    (16, 'Dwayne',   'member',    null,  false,  20),
    (17, 'Tyrone',   'member',    null,  false,  20);

  alter table _people add column id uuid, add column email text, add column phone text;
  update _people set
    id    = ('5eed0001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    email = case when n = 1 then 'admin@manup.test' else lower(name) || '@manup.test' end,
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

  -- ---------- Meetings: 6 past weeks + this week + next week, per active group ----------
  for g in select * from (values (grp_a, interval '1 day 7 hours'),
                                 (grp_b, interval '3 days 19 hours')) v(id, offs) loop
    for i in -6..1 loop
      insert into meetings (ministry_id, group_id, meeting_at, attendance_marked_at)
      values (m, g.id, week0 + g.offs + make_interval(weeks => i), null);
    end loop;
  end loop;

  -- Mark past meetings 3 hours after start, except the most recent Thursday one
  -- (Darnell's "Attendance to mark" case).
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

  -- ---------- Saturday gatherings: 4 past + 4 upcoming, twice a month ----------
  for i in -4..3 loop
    insert into gatherings (id, ministry_id, title, gathering_at, church_center_url, pco_event_id, location, canceled)
    values (('5eed0003-0000-4000-8000-' || lpad((i + 5)::text, 12, '0'))::uuid, m,
            'Men''s Ministry Meeting',
            week0 + interval '5 days 9 hours' + make_interval(weeks => i * 2),
            'https://lfcc.churchcenter.com/groups',
            'seed-evt-' || (i + 5),
            'Main Fellowship Hall',
            i = 2);  -- one upcoming gathering is canceled
  end loop;

  -- ---------- PCO read mirror ----------
  insert into pco_roster (ministry_id, pco_person_id, full_name, email, phone, synced_at)
  select m, 'seed-pco-' || lpad(n::text, 2, '0'), name,
    case when n in (13, 14) then lower(name) || '.home@manup.test' else email end,
    case when n in (13, 14) then null else phone end,
    now() - interval '6 hours'
  from _people where n between 2 and 14;

  insert into pco_roster (ministry_id, pco_person_id, full_name, email, phone, synced_at) values
    (m, 'seed-pco-90', 'Harold',  'harold@manup.test', '+15550100090', now() - interval '6 hours'),
    (m, 'seed-pco-91', 'Kenneth', null,                '+15550100091', now() - interval '6 hours'),
    (m, 'seed-pco-92', 'Samuel',  'samuel@manup.test', null,           now() - interval '6 hours');

  -- Admin-confirmed matches for 02-10 (11-14 wait in Nathan's Match queue).
  update profiles p set pco_person_id = 'seed-pco-' || lpad(x.n::text, 2, '0')
  from _people x where x.id = p.id and x.n between 2 and 10;

  insert into pco_match_log (ministry_id, profile_id, pco_person_id, action, performed_by, performed_at)
  select m, id, 'seed-pco-' || lpad(n::text, 2, '0'), 'matched',
         (select id from _people where n = 1), now() - interval '30 days'
  from _people where n between 2 and 10;

  insert into pco_gathering_attendance (ministry_id, pco_person_id, pco_event_id, event_at, pco_check_in_id, synced_at)
  select m, r.pco_person_id, ga.pco_event_id, ga.gathering_at,
         'seed-ci-' || r.pco_person_id || '-' || ga.pco_event_id, now() - interval '6 hours'
  from pco_roster r
  cross join gatherings ga
  where r.ministry_id = m and r.pco_person_id like 'seed-%'
    and ga.id::text like '5eed%' and ga.gathering_at < now() and not ga.canceled
    and abs(hashtext(r.pco_person_id || ga.pco_event_id)) % 4 <> 0;

  insert into pco_sync_log (id, ministry_id, resource, rows_upserted, status, ran_at) values
    ('5eed0008-0000-4000-8000-000000000001', m, 'roster', 16, 'ok', now() - interval '6 hours'),
    ('5eed0008-0000-4000-8000-000000000002', m, 'events', 8, 'ok', now() - interval '6 hours'),
    ('5eed0008-0000-4000-8000-000000000003', m, 'gathering_attendance',
     (select count(*) from pco_gathering_attendance where pco_person_id like 'seed-%'), 'ok',
     now() - interval '6 hours');

  -- ---------- Pray ----------
  -- Jerome (Tuesday): answered, with a testimony and a comment.
  insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, visibility, status, answered_note, created_at)
  values (m, grp_a, (select id from _people where n = 6),
          'Pray for my mother''s surgery on Thursday.', false, 'group', 'answered',
          'Surgery went well. She is home and recovering. Thank you, brothers.', now() - interval '12 days')
  returning id into pr;
  insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, body, created_at)
  select m, pr, id, 'prayed', null, now() - interval '11 days' from _people where n in (2, 4, 7, 8);
  insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, body, created_at)
  values (m, pr, (select id from _people where n = 2), 'comment', 'Praying for her and for you, Jerome.', now() - interval '11 days');

  -- Reginald (Thursday): open, group only.
  insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, visibility, status, created_at)
  values (m, grp_b, (select id from _people where n = 11),
          'Job interview next week. Pray for peace and favor.', false, 'group', 'open', now() - interval '3 days')
  returning id into pr;
  insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, created_at)
  select m, pr, id, 'prayed', now() - interval '2 days' from _people where n in (3, 5, 12);

  -- Curtis (Thursday): anonymous, group only.
  insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, visibility, status, created_at)
  values (m, grp_b, (select id from _people where n = 13),
          'Struggling in my marriage right now. Please pray.', true, 'group', 'open', now() - interval '1 day');

  -- Dwayne (no group): ministry-wide, with a welcome from Darnell.
  insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, visibility, status, created_at)
  values (m, null, (select id from _people where n = 16),
          'New here. Pray that I find my footing and a group of brothers.', false, 'ministry', 'open', now() - interval '2 days')
  returning id into pr;
  insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, created_at)
  select m, pr, id, 'prayed', now() - interval '1 day' from _people where n in (1, 2, 3, 9, 12);
  insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind, body, created_at)
  values (m, pr, (select id from _people where n = 3), 'comment', 'Welcome, Dwayne. Come by Thursday night.', now() - interval '1 day');

  -- Victor (Tuesday): anonymous and ministry-wide.
  insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, visibility, status, created_at)
  values (m, grp_a, (select id from _people where n = 9),
          'Finances are tight this month. Pray for provision.', true, 'ministry', 'open', now() - interval '4 days');

  -- ---------- Group chat ----------
  insert into group_messages (ministry_id, group_id, profile_id, body, created_at) values
    (m, grp_a, (select id from _people where n = 2),  'Good word this morning, men. See you Tuesday.', now() - interval '5 days'),
    (m, grp_a, (select id from _people where n = 7),  'Amen. Bringing coffee next week.',              now() - interval '5 days' + interval '20 minutes'),
    (m, grp_a, (select id from _people where n = 4),  'Byron, we missed you. Hope all is well.',       now() - interval '2 days'),
    (m, grp_a, (select id from _people where n = 6),  'Who is in for the food pantry?',                now() - interval '1 day'),
    (m, grp_b, (select id from _people where n = 3),  'Reminder: we start at 7 sharp Thursday.',       now() - interval '4 days'),
    (m, grp_b, (select id from _people where n = 12), 'I''ll be a few minutes late, save me a seat.',  now() - interval '1 day'),
    (m, grp_b, (select id from _people where n = 14), 'Honestly this group is a waste of my time.',    now() - interval '20 hours');

  -- ---------- Ministry chat (everyone in the ministry) ----------
  insert into ministry_messages (ministry_id, profile_id, body, mentions, created_at) values
    (m, (select id from _people where n = 1),  'Men, Saturday breakfast moves to 8:30 this week. Bring a brother.', '{}', now() - interval '3 days'),
    (m, (select id from _people where n = 16), 'New here. Anybody near the east side want to carpool Saturday?',  '{}', now() - interval '2 days'),
    (m, (select id from _people where n = 3),  '@Tyrone I''m on the east side. I''ll pick you up.',
       array[(select id from _people where n = 17)], now() - interval '2 days' + interval '1 hour'),
    (m, (select id from _people where n = 12), 'Thankful for this crew. Good word Saturday.',                         '{}', now() - interval '20 hours');

  -- ---------- Safety: one open report (Nathan's Reports page), one block ----------
  insert into content_reports (ministry_id, reporter_id, target_type, target_id, reason, created_at)
  select m, (select id from _people where n = 11), 'group_message', id, 'Discouraging to the group', now() - interval '18 hours'
  from group_messages where group_id = grp_b and profile_id = (select id from _people where n = 14);

  insert into user_blocks (ministry_id, blocker_id, blocked_id)
  values (m, (select id from _people where n = 17), (select id from _people where n = 16));

  -- ---------- Courses and content (normally synced from Sanity) ----------
  insert into courses (id, ministry_id, sanity_id, title, description, is_published)
  values (course, m, 'seed-course-stepping-up', 'Stepping Up',
          'Four weeks on what it means to stand up and lead: in faith, at home, and among your brothers.', true);

  insert into lessons (id, ministry_id, course_id, sanity_id, title, sort_order, scripture_ref, scripture_text, body, reflection_questions)
  select ('5eed0005-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, m, course, 'seed-lesson-' || n, t, n, ref, txt, body, q::jsonb
  from (values
    (1, 'Called to Stand', 'Joshua 1:9',
        'Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.',
        'Every man is called to stand somewhere. This week, look at where you have been standing on the sidelines.',
        '["Where are you standing on the sidelines?", "What would stepping up look like this week?"]'),
    (2, 'Integrity When No One Is Watching', 'Proverbs 10:9', 'Whoever walks in integrity walks securely.',
        'Integrity is who you are when nobody is keeping score.',
        '["Where is the gap between your public and private life?", "Who can you ask to hold you to it?"]'),
    (3, 'Leading at Home', 'Joshua 24:15', 'As for me and my household, we will serve the Lord.',
        'Leadership starts at your own table.',
        '["What does your family need from you right now?", "What is one way you will serve them this week?"]'),
    (4, 'Brothers in Arms', 'Hebrews 10:24-25', 'Let us consider how we may spur one another on toward love and good deeds.',
        'No man stands alone for long. We need brothers who show up.',
        '["Who is the brother you would call at 2 a.m.?", "Who needs you to be that brother?"]')
  ) l(n, t, ref, txt, body, q);

  -- Marcus and Andre finished; Jerome and Calvin are halfway; Reginald and Omar started.
  insert into lesson_progress (ministry_id, lesson_id, profile_id, completed_at, reflection)
  select m, ('5eed0005-0000-4000-8000-' || lpad(l::text, 12, '0'))::uuid, p.id,
         now() - make_interval(days => 24 - l * 6),
         case when p.n = 6 and l = 1 then 'I have been standing on the sidelines too long. Time to show up for my sons.' end
  from _people p cross join generate_series(1, 4) l
  where (p.n in (2, 4)) or (p.n in (6, 7) and l <= 2) or (p.n in (11, 12) and l = 1);

  insert into weekly_questions (ministry_id, sanity_id, week_of, title, questions) values
    (m, 'seed-weekly-1', (week0 at time zone 'America/New_York')::date, 'Leading at Home',
     '["What does your family need from you right now?", "Who is one man you can encourage before Saturday?", "What is one step you will take, and who will check on you?"]'),
    (m, 'seed-weekly-0', (week0 at time zone 'America/New_York')::date - 7, 'Called to Stand',
     '["Where do you need courage this week?", "Where have you been standing on the sidelines?"]');

  -- Gathering pages: the next one (pre-work) and the last one (recap).
  insert into gathering_content (ministry_id, sanity_id, gathering_date, topic, teacher, prework_questions, recap, takehome_questions)
  select m, 'seed-gathering-content-next', (gathering_at at time zone 'America/New_York')::date,
         'Leading at Home', 'Guest teacher',
         '["What does leadership at home look like for you right now?"]', null,
         '["Name one way you will serve your family this week."]'
  from gatherings where id = '5eed0003-0000-4000-8000-000000000005';
  insert into gathering_content (ministry_id, sanity_id, gathering_date, topic, teacher, prework_questions, recap, takehome_questions)
  select m, 'seed-gathering-content-last', (gathering_at at time zone 'America/New_York')::date,
         'Called to Stand', 'Guest teacher', '[]',
         'We talked about Joshua standing up after Moses. Leadership is not a title; it is showing up when it counts.',
         '["Where is God asking you to stand up this month?"]'
  from gatherings where id = '5eed0003-0000-4000-8000-000000000004';

  -- ---------- Serve (normally synced from PCO Registrations) ----------
  insert into serve_opportunities (id, ministry_id, title, description, when_text, church_center_url, registration_open, active) values
    (opp_pantry, m, 'Community Food Pantry', 'Sort and hand out groceries for neighbors in need.',
     to_char((week0 + interval '12 days') at time zone 'America/New_York', 'FMMonth FMDD, YYYY'),
     'https://lfcc.churchcenter.com/registrations', true, true),
    (opp_breakfast, m, 'Men''s Breakfast Setup', 'Set up tables and cook for the men''s breakfast.',
     to_char((week0 - interval '2 days') at time zone 'America/New_York', 'FMMonth FMDD, YYYY'),
     'https://lfcc.churchcenter.com/registrations', false, true),
    (opp_parking, m, 'Parking Team', 'Greet families and help with parking on Sunday mornings.',
     'Sundays', 'https://lfcc.churchcenter.com/registrations', true, true);

  -- Tuesday group took on the pantry (Jerome and Calvin are in).
  insert into serve_claims (ministry_id, group_id, opportunity_id, claimed_by)
  values (m, grp_a, opp_pantry, (select id from _people where n = 2)) returning id into claim;
  insert into serve_claim_optins (ministry_id, claim_id, profile_id)
  select m, claim, id from _people where n in (6, 7);

  -- Tuesday group served the breakfast last weekend; Marcus confirmed who came.
  insert into serve_claims (ministry_id, group_id, opportunity_id, claimed_by, confirmed_at)
  values (m, grp_a, opp_breakfast, (select id from _people where n = 2), week0 - interval '1 day') returning id into claim;
  insert into serve_claim_optins (ministry_id, claim_id, profile_id)
  select m, claim, id from _people where n in (2, 6, 7, 8);
  insert into serve_logs (ministry_id, opportunity_id, profile_id, served_at, logged_by)
  select m, opp_breakfast, id, ((week0 - interval '2 days') at time zone 'America/New_York')::date, (select id from _people where n = 2)
  from _people where n in (2, 6, 7, 8);
  insert into serve_logs (ministry_id, opportunity_id, profile_id, served_at, logged_by)
  values (m, opp_parking, (select id from _people where n = 11), current_date - 20, (select id from _people where n = 3));

  -- ---------- Shepherding contacts (no notes, per the scoring plan) ----------
  insert into contact_logs (ministry_id, profile_id, leader_id, contacted_at, method) values
    (m, (select id from _people where n = 6),  (select id from _people where n = 2), now() - interval '4 days',  'call'),
    (m, (select id from _people where n = 7),  (select id from _people where n = 4), now() - interval '9 days',  'text'),
    (m, (select id from _people where n = 8),  (select id from _people where n = 2), now() - interval '40 days', 'in_person'),
    (m, (select id from _people where n = 11), (select id from _people where n = 3), now() - interval '2 days',  'call'),
    (m, (select id from _people where n = 13), (select id from _people where n = 3), now() - interval '1 day',   'text'),
    (m, (select id from _people where n = 12), (select id from _people where n = 5), now() - interval '12 days', 'in_person');

  -- Curtis is walking through a hard season (Darnell set it; pauses his alerts).
  insert into season_flags (ministry_id, profile_id, set_by, starts_on, ends_on)
  values (m, (select id from _people where n = 13), (select id from _people where n = 3), current_date - 3, current_date + 27);

  -- ---------- Score history: the last three Sundays ----------
  -- Tiers, trends, and the Health board show before any run. Byron declines each
  -- week, so his velocity flag fires the next time scoring runs.
  for i in 1..3 loop
    for u in select * from _people loop
      insert into member_scores (ministry_id, profile_id, as_of, total, tier, velocity_alert, components, trend, is_new, paused)
      values (m, u.id, last_sunday - (i - 1) * 7,
        case u.n when 10 then 50 + i * 12            -- Byron: 62, 74, 86 (newest first)
                 when 16 then 32 when 17 then 28     -- unplaced men
                 when 14 then 45                     -- Leon: drifting
                 else 70 + (u.n % 4) * 5 end,
        case when u.n = 15 then 'New'
             when u.n = 10 then case when 50 + i * 12 >= 80 then 'Thriving' else 'Steady' end
             when u.n = 16 then 'Drifting' when u.n = 17 then 'Disconnected' when u.n = 14 then 'Drifting'
             when 70 + (u.n % 4) * 5 >= 80 then 'Thriving' else 'Steady' end,
        false, '{}',
        case when u.n = 10 and i < 3 then 'down' else 'flat' end,
        u.n = 15, u.n = 13);
    end loop;
  end loop;

  insert into leader_scores (ministry_id, profile_id, group_id, as_of, total, tier, components) values
    (m, (select id from _people where n = 2), grp_a, last_sunday, 82, 'Consistent', '{}'),
    (m, (select id from _people where n = 4), grp_a, last_sunday, 71, 'Inconsistent', '{}'),
    (m, (select id from _people where n = 3), grp_b, last_sunday, 64, 'Inconsistent', '{}'),
    (m, (select id from _people where n = 5), grp_b, last_sunday, 40, 'Inactive', '{}');

  insert into group_scores (ministry_id, group_id, as_of, total, band, components, triggers) values
    (m, grp_a, last_sunday, 78, 'Healthy',
     '{"engagement":{"earned":30,"max":40,"applicable":true},"spread":{"earned":12,"max":15,"applicable":true}}', '[]'),
    (m, grp_b, last_sunday, 58, 'At Risk',
     '{"engagement":{"earned":26,"max":40,"applicable":true},"spread":{"earned":6,"max":15,"applicable":true}}', '["Leader is Inactive"]');

  -- ---------- Invite codes (open signup makes men members; these grant leader roles) ----------
  insert into invite_codes (id, ministry_id, code, role_granted, max_uses, created_by) values
    ('5eed0007-0000-4000-8000-000000000001', m, 'SEED-COLEAD', 'co_leader', 5, (select id from _people where n = 1)),
    ('5eed0007-0000-4000-8000-000000000002', m, 'SEED-LEADER', 'leader',    5, (select id from _people where n = 1));
end $$;
