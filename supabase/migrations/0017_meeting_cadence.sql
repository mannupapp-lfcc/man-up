-- ============================================================
-- Man Up - How often a group meets (0017_meeting_cadence.sql).
-- Kevin reviews this function before push. No RLS policy changes.
--
--   groups.meeting_every_weeks   1 = every week (default, as before), 2 = every other
--                                week, up to 4 = every fourth week.
--   groups.meeting_start_date    any date in a week the group meets. Required when it
--                                meets less than weekly: it says WHICH weeks. Meeting
--                                weeks are this date's week and every Nth week from it,
--                                in either direction (weeks start Monday).
--   generate_meetings            same as 0004, plus the cadence: it creates meetings
--                                only in meeting weeks, and removes future meetings
--                                (never one with attendance) that are not in one.
-- ============================================================

alter table groups add column meeting_every_weeks smallint not null default 1
  check (meeting_every_weeks between 1 and 4);
alter table groups add column meeting_start_date date;
alter table groups add constraint groups_meeting_start_date_check
  check (meeting_every_weeks = 1 or meeting_start_date is not null);

-- True when local date p_day falls in one of the group's meeting weeks.
create or replace function fn_is_meeting_week(p_day date, p_every smallint, p_start date)
returns boolean
language sql immutable set search_path = public as $$
  select p_every <= 1 or p_start is null
      or mod((date_trunc('week', p_day)::date - date_trunc('week', p_start)::date) / 7, p_every) = 0
$$;

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
         or (mt.meeting_at at time zone v_tz)::time <> g.meeting_time
         or not fn_is_meeting_week((mt.meeting_at at time zone v_tz)::date, g.meeting_every_weeks, g.meeting_start_date));

  insert into meetings (ministry_id, group_id, meeting_at)
  select g.ministry_id, g.id, (d::date + g.meeting_time) at time zone v_tz
  from groups g
  cross join generate_series((now() at time zone v_tz)::date,
                             (now() at time zone v_tz)::date + (p_weeks * 7 - 1),
                             interval '1 day') d
  where g.ministry_id = p_ministry and g.status = 'active'
    and g.meeting_time is not null
    and extract(isodow from d) = array_position(v_days, g.meeting_day)
    and fn_is_meeting_week(d::date, g.meeting_every_weeks, g.meeting_start_date)
    and (d::date + g.meeting_time) at time zone v_tz > now()
  on conflict (group_id, meeting_at) do nothing;

  get diagnostics v_created = row_count;
  return v_created;
end $$;
