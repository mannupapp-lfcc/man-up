-- ============================================================
-- Man Up - My Group (0004_my_group.sql). Build order slice 4.
--
-- Group schedule, one active group per man, meeting generation, and leader
-- attendance marking. Every function here is SECURITY INVOKER: the 0002 RLS
-- policies decide who may do what, and these functions only make multi-row
-- changes atomic.
--   generate_meetings(ministry, weeks)       admins (and the scheduled job)
--   mark_attendance(meeting, present, excused) the group's leaders, admins
--   place_member(group, profile)             admins
--   set_group_leader(group, profile, role)   admins
-- ============================================================

-- ---------- Schedule ----------
-- meeting_day already exists (e.g. 'Tuesday'); meeting_time is local time in the
-- ministry's timezone (ministry_config 'timezone').
alter table groups add column meeting_time time;
alter table groups add constraint groups_meeting_day_check check (
  meeting_day is null or meeting_day in
    ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'));

insert into ministry_config (ministry_id, key, value) values
  ('00000000-0000-0000-0000-000000000002', 'timezone', '"America/New_York"');

-- A man is in at most one group at a time (fixed groups of 4 to 8).
create unique index group_members_one_active_group
  on group_members (ministry_id, profile_id) where left_at is null;

-- One meeting per group per start time, so generation can run any number of times.
alter table meetings add constraint meetings_group_time_key unique (group_id, meeting_at);

create or replace function fn_ministry_timezone(p_ministry uuid)
returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value #>> '{}' from ministry_config
                   where ministry_id = p_ministry and key = 'timezone'), 'UTC')
$$;

-- ---------- Meeting generation ----------
-- Creates the next p_weeks of meetings for every active group with a schedule, and
-- removes future meetings that no longer match a group's schedule (never one that
-- has attendance). Safe to run repeatedly. Returns the number of meetings created.
create or replace function generate_meetings(p_ministry uuid, p_weeks int default 4)
returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_tz      text := fn_ministry_timezone(p_ministry);
  v_created int;
  v_days    text[] := array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
begin
  if not fn_is_admin(p_ministry) and auth.role() is distinct from 'service_role' then
    raise exception 'Only a ministry admin can schedule meetings.' using errcode = '42501';
  end if;

  delete from meetings mt
  using groups g
  where g.id = mt.group_id and g.ministry_id = p_ministry and mt.ministry_id = p_ministry
    and mt.meeting_at > now() and mt.attendance_marked_at is null
    and not exists (select 1 from meeting_attendance a where a.meeting_id = mt.id)
    and (g.status <> 'active' or g.meeting_day is null or g.meeting_time is null
         or extract(isodow from mt.meeting_at at time zone v_tz) <> array_position(v_days, g.meeting_day)
         or (mt.meeting_at at time zone v_tz)::time <> g.meeting_time);

  insert into meetings (ministry_id, group_id, meeting_at)
  select g.ministry_id, g.id, (d::date + g.meeting_time) at time zone v_tz
  from groups g
  cross join generate_series((now() at time zone v_tz)::date,
                             (now() at time zone v_tz)::date + (p_weeks * 7 - 1),
                             interval '1 day') d
  where g.ministry_id = p_ministry and g.status = 'active'
    and g.meeting_time is not null
    and extract(isodow from d) = array_position(v_days, g.meeting_day)
    and (d::date + g.meeting_time) at time zone v_tz > now()
  on conflict (group_id, meeting_at) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end $$;

-- ---------- Attendance ----------
-- Marks every current member of the meeting's group in one step: present, excused,
-- or absent (everyone not listed). Stamps attendance_marked_at (server clock, first
-- mark sticks; see 0002). Marking after 72 hours is allowed, but the scoring job
-- does not count that meeting as held.
create or replace function mark_attendance(p_meeting uuid, p_present uuid[], p_excused uuid[] default '{}')
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_meeting meetings%rowtype;
  v_unknown int;
begin
  select * into v_meeting from meetings where id = p_meeting;
  if not found then
    raise exception 'Meeting not found.' using errcode = 'P0002';
  end if;
  if v_meeting.meeting_at > now() then
    raise exception 'This meeting has not happened yet.' using errcode = 'P0001';
  end if;

  select count(*) into v_unknown
  from unnest(coalesce(p_present, '{}') || coalesce(p_excused, '{}')) as x(profile_id)
  where not exists (select 1 from group_members gm
                    where gm.group_id = v_meeting.group_id and gm.profile_id = x.profile_id
                      and gm.left_at is null);
  if v_unknown > 0 then
    raise exception 'Only men in this group can be marked.' using errcode = 'P0001';
  end if;

  insert into meeting_attendance (ministry_id, meeting_id, profile_id, status, marked_by, marked_at)
  select v_meeting.ministry_id, v_meeting.id, gm.profile_id,
    case when gm.profile_id = any(coalesce(p_present, '{}')) then 'present'
         when gm.profile_id = any(coalesce(p_excused, '{}')) then 'excused'
         else 'absent' end::attendance_status,
    auth.uid(), now()
  from group_members gm
  where gm.group_id = v_meeting.group_id and gm.left_at is null
  on conflict (meeting_id, profile_id) do update
    set status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at;

  update meetings set attendance_marked_at = now() where id = v_meeting.id;
  if not found then
    raise exception 'You can only mark meetings for a group you lead.' using errcode = '42501';
  end if;
end $$;

-- ---------- Placement and leaders (admins) ----------
-- Moves a man into a group, ending any other active group membership in the
-- ministry. He joins as a regular member of the group (not a leader).
create or replace function place_member(p_group uuid, p_profile uuid)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_ministry uuid;
begin
  select ministry_id into v_ministry from groups where id = p_group;
  if v_ministry is null or not fn_is_admin(v_ministry) then
    raise exception 'Only a ministry admin can place men in groups.' using errcode = '42501';
  end if;
  if not exists (select 1 from ministry_members
                 where ministry_id = v_ministry and profile_id = p_profile and left_at is null) then
    raise exception 'He is not a member of this ministry.' using errcode = 'P0001';
  end if;

  update group_members set left_at = now(), is_group_leader = false
  where ministry_id = v_ministry and profile_id = p_profile and left_at is null and group_id <> p_group;

  insert into group_members (ministry_id, group_id, profile_id)
  values (v_ministry, p_group, p_profile)
  on conflict (group_id, profile_id) do update
    set left_at = null, joined_at = case when group_members.left_at is null
                                         then group_members.joined_at else now() end;
end $$;

-- Makes a man a leader or co-leader of his group. Sets his ministry role too,
-- except that an admin stays an admin.
create or replace function set_group_leader(p_group uuid, p_profile uuid, p_role ministry_role)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_ministry uuid;
begin
  if p_role not in ('co_leader', 'leader') then
    raise exception 'Role must be co_leader or leader.' using errcode = '22023';
  end if;
  select ministry_id into v_ministry from groups where id = p_group;
  if v_ministry is null or not fn_is_admin(v_ministry) then
    raise exception 'Only a ministry admin can assign group leaders.' using errcode = '42501';
  end if;

  update group_members set is_group_leader = true
  where group_id = p_group and profile_id = p_profile and left_at is null;
  if not found then
    raise exception 'Place him in this group first.' using errcode = 'P0001';
  end if;

  update ministry_members set role = p_role, role_since = current_date
  where ministry_id = v_ministry and profile_id = p_profile and role not in ('admin', p_role);
end $$;

revoke execute on function fn_ministry_timezone(uuid)                   from public, anon;
revoke execute on function generate_meetings(uuid, int)                 from public, anon;
revoke execute on function mark_attendance(uuid, uuid[], uuid[])        from public, anon;
revoke execute on function place_member(uuid, uuid)                     from public, anon;
revoke execute on function set_group_leader(uuid, uuid, ministry_role)  from public, anon;
