-- ============================================================
-- Man Up - Gatherings and the PCO read sync (0006_pco_sync.sql). Build order slice 5.
--
-- Planning Center stays read-only (Non-negotiable 3). The nightly sync (Inngest,
-- service role) mirrors, per ministry:
--   roster      the configured PCO group's members        -> pco_roster
--   events      that group's events (meetings, courses,   -> gatherings
--               retreats), including cancellations
--   attendance  check-ins at the configured PCO Check-Ins -> pco_gathering_attendance
--               events
-- Admins confirm PCO matches through confirm_pco_match (the only way
-- profiles.pco_person_id is ever set, Non-negotiable 4).
-- ============================================================

-- ---------- Man Up's PCO configuration ----------
-- pco_group_id: Men's Ministry in PCO Groups. pco_checkin_event_ids: the Check-Ins
-- events whose check-ins count as gathering attendance (admins choose them on the
-- admin site; empty until the church sets up a Men's Ministry Meeting check-in).
insert into ministry_config (ministry_id, key, value) values
  ('00000000-0000-0000-0000-000000000002', 'pco_group_id', '"157955"'),
  ('00000000-0000-0000-0000-000000000002', 'pco_checkin_event_ids', '[]')
on conflict (ministry_id, key) do nothing;

-- ---------- Gatherings mirror PCO group events ----------
alter table gatherings add column pco_group_event_id text;
alter table gatherings add column ends_at timestamptz;
alter table gatherings add column location text;
alter table gatherings add column canceled boolean not null default false;
alter table gatherings add column synced_at timestamptz;
alter table gatherings add constraint gatherings_pco_group_event_key unique (ministry_id, pco_group_event_id);

-- ---------- Attendance: one row per PCO check-in ----------
-- A weekly Check-Ins event (e.g. Men Stepping Up) has many sessions under one event
-- id, so the old (person, event) key would collapse them. Key on the check-in.
alter table pco_gathering_attendance add column pco_check_in_id text;
alter table pco_gathering_attendance drop constraint pco_gathering_attendance_ministry_id_pco_person_id_pco_even_key;
alter table pco_gathering_attendance add constraint pco_gathering_attendance_check_in_key unique (ministry_id, pco_check_in_id);

alter table pco_sync_log drop constraint pco_sync_log_resource_check;
alter table pco_sync_log add constraint pco_sync_log_resource_check
  check (resource in ('roster', 'events', 'gathering_attendance'));

-- ---------- PCO Match queue (admins) ----------
-- Links a man's profile to a person on this ministry's PCO roster. Refused unless
-- the caller is an admin of a ministry the man belongs to and the PCO person is on
-- that ministry's roster. Every change is logged in pco_match_log.
create or replace function confirm_pco_match(p_profile uuid, p_pco_person_id text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ministry uuid;
begin
  select mm.ministry_id into v_ministry
  from ministry_members mm
  join pco_roster r on r.ministry_id = mm.ministry_id and r.pco_person_id = p_pco_person_id
  where mm.profile_id = p_profile and mm.left_at is null and fn_is_admin(mm.ministry_id)
  limit 1;
  if v_ministry is null then
    raise exception 'Only an admin of his ministry can match him, to someone on that ministry''s PCO roster.'
      using errcode = '42501';
  end if;
  if exists (select 1 from profiles where pco_person_id = p_pco_person_id and id <> p_profile) then
    raise exception 'That PCO person is already matched to another account.' using errcode = 'P0001';
  end if;

  update profiles set pco_person_id = p_pco_person_id where id = p_profile;
  insert into pco_match_log (ministry_id, profile_id, pco_person_id, action, performed_by)
  values (v_ministry, p_profile, p_pco_person_id, 'matched', auth.uid());
end $$;

create or replace function clear_pco_match(p_profile uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_ministry uuid;
begin
  select mm.ministry_id into v_ministry
  from ministry_members mm
  where mm.profile_id = p_profile and mm.left_at is null and fn_is_admin(mm.ministry_id)
  limit 1;
  if v_ministry is null then
    raise exception 'Only an admin of his ministry can clear his match.' using errcode = '42501';
  end if;

  update profiles set pco_person_id = null where id = p_profile;
  insert into pco_match_log (ministry_id, profile_id, pco_person_id, action, performed_by)
  values (v_ministry, p_profile, null, 'cleared', auth.uid());
end $$;

revoke execute on function confirm_pco_match(uuid, text) from public, anon, authenticated;
revoke execute on function clear_pco_match(uuid)         from public, anon, authenticated;
grant execute on function confirm_pco_match(uuid, text) to authenticated;
grant execute on function clear_pco_match(uuid)         to authenticated;
