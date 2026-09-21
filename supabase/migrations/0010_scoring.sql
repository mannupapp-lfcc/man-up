-- ============================================================
-- Man Up - Scoring (0010_scoring.sql). Build order slice 8, docs/scoring-plan.md.
--
-- The Sunday night Inngest job (service role) computes member, leader, and group
-- scores per ministry against that ministry's own score_config rows.
-- Visibility (Non-negotiable 5, scoring plan section 6):
--   members   their own tier and trend only, via my_progress(); never a number
--   leaders   tiers, trends, velocity flags for their own group via group_tiers();
--             no direct read of member_scores (closes the slice 2 numeric gap)
--   admins    everything, including numbers, leader and group scores
-- Scores use counts of activity only, never content (Non-negotiable 2).
-- Kevin reviews every policy here before push.
-- ============================================================

-- ---------- Score rows ----------
alter table member_scores add column trend text check (trend in ('up', 'flat', 'down'));
alter table member_scores add column is_new boolean not null default false;     -- first 30 days in his group
alter table member_scores add column paused boolean not null default false;     -- active season flag

alter table leader_scores add column group_id uuid references groups(id);
alter table leader_scores add column tier text;

create table group_scores (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  group_id uuid not null references groups(id),
  as_of date not null,
  total numeric not null,
  band text not null,                       -- Healthy | Watch | At Risk
  components jsonb not null,
  triggers jsonb not null default '[]',     -- automatic at-risk triggers that fired
  unique (ministry_id, group_id, as_of)
);
alter table group_scores enable row level security;
create policy "group_scores: admins read" on group_scores
  for select to authenticated using (fn_is_admin(ministry_id));

-- ---------- Leaders see tiers, not numbers ----------
drop policy "member_scores: group leaders and admins read" on member_scores;
create policy "member_scores: admins read" on member_scores
  for select to authenticated using (fn_is_admin(ministry_id));

-- Latest tier per man in a group the caller leads. No total, no components.
create or replace function group_tiers(p_group uuid)
returns table (profile_id uuid, tier text, trend text, velocity_alert boolean, is_new boolean, paused boolean, as_of date)
language sql stable security definer set search_path = public as $$
  select distinct on (s.profile_id) s.profile_id, s.tier, s.trend, s.velocity_alert, s.is_new, s.paused, s.as_of
  from member_scores s
  join groups g on g.id = p_group
  join group_members gm on gm.group_id = p_group and gm.profile_id = s.profile_id and gm.left_at is null
  where s.ministry_id = g.ministry_id
    and fn_leads_group(g.ministry_id, p_group)
  order by s.profile_id, s.as_of desc
$$;

-- A man's own progress: his tier and trend (never the number) plus plain counts.
create or replace function my_progress(p_ministry uuid)
returns table (tier text, trend text, is_new boolean, as_of date,
               meetings_attended_90d int, lessons_completed int, times_served int, gatherings_attended_90d int)
language sql stable security definer set search_path = public as $$
  select
    (select s.tier from member_scores s where s.ministry_id = p_ministry and s.profile_id = auth.uid() order by s.as_of desc limit 1),
    (select s.trend from member_scores s where s.ministry_id = p_ministry and s.profile_id = auth.uid() order by s.as_of desc limit 1),
    (select s.is_new from member_scores s where s.ministry_id = p_ministry and s.profile_id = auth.uid() order by s.as_of desc limit 1),
    (select s.as_of from member_scores s where s.ministry_id = p_ministry and s.profile_id = auth.uid() order by s.as_of desc limit 1),
    (select count(*)::int from meeting_attendance a join meetings m on m.id = a.meeting_id
      where a.profile_id = auth.uid() and a.ministry_id = p_ministry and a.status = 'present'
        and m.meeting_at > now() - interval '90 days'),
    (select count(*)::int from lesson_progress lp where lp.profile_id = auth.uid() and lp.ministry_id = p_ministry
        and lp.completed_at is not null),
    (select count(*)::int from serve_logs sl where sl.profile_id = auth.uid() and sl.ministry_id = p_ministry),
    (select count(*)::int from pco_gathering_attendance ga join profiles p on p.pco_person_id = ga.pco_person_id
      where p.id = auth.uid() and ga.ministry_id = p_ministry and ga.event_at > now() - interval '90 days')
  where fn_ministry_role(p_ministry) is not null
$$;

-- ---------- Season-of-life flags (pause alerts, max 60 days) ----------
create table season_flags (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id),
  set_by uuid not null references profiles(id),
  starts_on date not null default current_date,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 60)
);
alter table season_flags enable row level security;

create policy "season_flags: his group leaders and admins read" on season_flags
  for select to authenticated
  using (fn_leads_member(ministry_id, profile_id) or fn_is_admin(ministry_id));
create policy "season_flags: his group leaders set" on season_flags
  for insert to authenticated
  with check (set_by = auth.uid() and fn_leads_member(ministry_id, profile_id));
create policy "season_flags: his group leaders end" on season_flags
  for delete to authenticated
  using (fn_leads_member(ministry_id, profile_id) or fn_is_admin(ministry_id));

-- ---------- Weights and thresholds (scoring plan v1.1 defaults) ----------
-- Every weight lives here, per ministry; code never hardcodes one.
insert into score_config (ministry_id, key, value)
select '00000000-0000-0000-0000-000000000002', k, v from (values
  ('individual.attendance', 30), ('individual.serving', 20), ('individual.serving_one', 15),
  ('individual.checkin', 15), ('individual.gathering', 15), ('individual.participation', 10),
  ('individual.course', 10),
  ('individual.window_days', 30), ('individual.serving_window_days', 90),
  ('individual.tier.thriving', 80), ('individual.tier.steady', 55), ('individual.tier.drifting', 30),
  ('individual.new_member_days', 30), ('individual.velocity_weeks', 3), ('individual.trend_delta', 3),
  ('leader.coverage', 35), ('leader.followthrough', 25), ('leader.meetings', 25), ('leader.personal', 15),
  ('leader.window_days', 60), ('leader.coverage_days', 30), ('leader.followthrough_days', 7),
  ('leader.tier.consistent', 75), ('leader.tier.inconsistent', 45),
  ('group.engagement', 40), ('group.attendance', 20), ('group.meetings', 15), ('group.spread', 15), ('group.stability', 10),
  ('group.window_days', 60), ('group.band.healthy', 75), ('group.band.watch', 50),
  ('group.trigger.no_meeting_days', 21), ('group.trigger.low_attendance_pct', 50),
  ('group.trigger.low_attendance_meetings', 3), ('group.trigger.quiet_days', 14),
  ('meeting.marked_within_hours', 72)
) d(k, v)
on conflict (ministry_id, key) do nothing;

-- Tuning is a data change, logged with a reason (scoring plan section 9).
create table score_config_changes (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  key text not null,
  old_value numeric,
  new_value numeric not null,
  reason text not null,
  changed_by uuid not null references profiles(id),
  changed_at timestamptz not null default now()
);
alter table score_config_changes enable row level security;
create policy "score_config_changes: admins read" on score_config_changes
  for select to authenticated using (fn_is_admin(ministry_id));

create or replace function set_score_config(p_ministry uuid, p_key text, p_value numeric, p_reason text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old numeric;
begin
  if not fn_is_admin(p_ministry) then
    raise exception 'Only a ministry admin can tune scoring.' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Give a reason for the change.' using errcode = '22023';
  end if;
  select value into v_old from score_config where ministry_id = p_ministry and key = p_key for update;
  if not found then
    raise exception 'Unknown setting %.', p_key using errcode = 'P0002';
  end if;
  update score_config set value = p_value, updated_at = now(), updated_by = auth.uid()
  where ministry_id = p_ministry and key = p_key;
  insert into score_config_changes (ministry_id, key, old_value, new_value, reason, changed_by)
  values (p_ministry, p_key, v_old, p_value, trim(p_reason), auth.uid());
end $$;

revoke execute on function group_tiers(uuid)                              from public, anon;
revoke execute on function my_progress(uuid)                              from public, anon;
revoke execute on function set_score_config(uuid, text, numeric, text)    from public, anon;
revoke all on group_scores, season_flags, score_config_changes from anon;
