-- ============================================================
-- 0020: Ministry overseers (the pastors over the whole ministry).
-- Kevin reviews every policy and function here before push.
--
-- An overseer is a ministry admin with ministry_members.is_overseer = true. The
-- flag sits beside the role, so an overseer keeps every admin tool. It does nothing
-- for a man who is not an admin (fn_oversees checks both).
--
-- Policy change (signed off by Kevin 2026-11-21): overseers can READ, in every group
-- of their ministry,
--   group chat, group-only prayer requests and their responses, weekly check-ins
--   (with notes), contact logs (date, method, who; never the note column),
--   the group's weekly questions, and the leader's tier view (group_tiers).
-- They never write into a group: no posting, praying, commenting, or check-in.
-- Still private from overseers: lesson reflections, and the author of an anonymous
-- prayer request. Nothing crosses ministry_id. Nothing reaches any dashboard, score,
-- or report; this is reading the group's own screens, not an aggregate.
--
-- Guard rails: an admin cannot make himself an overseer (another admin must), every
-- grant is stamped with who and when, and any member can see who the overseers are
-- (ministry_overseers) so the privacy screen can name them.
-- ============================================================

alter table ministry_members
  add column is_overseer boolean not null default false,
  -- No foreign key on purpose: a second ministry_members -> profiles link would make
  -- every existing profiles(...) embed on ministry_members ambiguous in PostgREST.
  add column overseer_granted_by uuid,
  add column overseer_granted_at timestamptz;

-- Caller is a current admin of the ministry flagged as overseer.
create or replace function fn_oversees(p_ministry uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ministry_members
    where ministry_id = p_ministry and profile_id = auth.uid() and left_at is null
      and role = 'admin' and is_overseer)
$$;

-- No self-grant, and every change is stamped. auth.uid() is null for server jobs
-- and the SQL editor, which may set the flag directly (first grant at launch).
create or replace function fn_stamp_overseer()
returns trigger language plpgsql set search_path = public as $$
begin
  -- No longer an admin, or left the ministry: no longer an overseer.
  if new.role <> 'admin' or new.left_at is not null then
    new.is_overseer := false;
  end if;
  if new.is_overseer is distinct from old.is_overseer then
    if auth.uid() is not null and auth.uid() = new.profile_id and new.is_overseer then
      raise exception 'Another admin must make you an overseer.' using errcode = '42501';
    end if;
    new.overseer_granted_by := case when new.is_overseer then auth.uid() end;
    new.overseer_granted_at := case when new.is_overseer then now() end;
  elsif new.overseer_granted_by is distinct from old.overseer_granted_by
     or new.overseer_granted_at is distinct from old.overseer_granted_at then
    new.overseer_granted_by := old.overseer_granted_by;
    new.overseer_granted_at := old.overseer_granted_at;
  end if;
  return new;
end $$;

create trigger ministry_members_overseer
  before update on ministry_members
  for each row execute function fn_stamp_overseer();

-- Inserts start unflagged (invite codes and signup never grant oversight).
create or replace function fn_no_overseer_on_insert()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_overseer and auth.uid() is not null then
    raise exception 'Make a man an overseer after he joins.' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger ministry_members_overseer_insert
  before insert on ministry_members
  for each row execute function fn_no_overseer_on_insert();

-- ---------- Read policies (additive; nothing existing is dropped) ----------
create policy "group_messages: overseers read" on group_messages
  for select to authenticated
  using (fn_oversees(ministry_id) and not fn_has_blocked(profile_id));

-- profile_id stays unreadable to clients (column grants, 0002), so anonymous
-- requests keep their author hidden here too.
create policy "prayer_requests: overseers read group requests" on prayer_requests
  for select to authenticated
  using (visibility = 'group' and fn_oversees(ministry_id));
-- prayer_interactions follows automatically: its read policy checks the request
-- under the caller's own prayer_requests policy.

-- Overseers read but never pray or respond inside a group they are not in. The
-- insert must be on a request the caller can see as a man (his group, or ministry
-- wide). Restrictive, so it narrows the existing insert policy without replacing it.
create policy "prayer_interactions: only on requests he can see as a man" on prayer_interactions
  as restrictive for insert to authenticated
  with check (exists (select 1 from prayer_requests pr
                      where pr.id = prayer_interactions.prayer_request_id
                        and fn_can_see_prayer(pr.visibility, pr.ministry_id, pr.group_id)));

create policy "weekly_checkins: overseers read" on weekly_checkins
  for select to authenticated
  using (fn_oversees(ministry_id) and not fn_has_blocked(profile_id));

create policy "group_weekly_questions: overseers read" on group_weekly_questions
  for select to authenticated
  using (fn_oversees(ministry_id));

-- ---------- Functions ----------
-- Leader tier view: the group's leaders, and now overseers.
create or replace function group_tiers(p_group uuid)
returns table (profile_id uuid, tier text, trend text, velocity_alert boolean, is_new boolean, paused boolean, as_of date)
language sql stable security definer set search_path = public as $$
  select distinct on (s.profile_id) s.profile_id, s.tier, s.trend, s.velocity_alert, s.is_new, s.paused, s.as_of
  from member_scores s
  join groups g on g.id = p_group
  join group_members gm on gm.group_id = p_group and gm.profile_id = s.profile_id and gm.left_at is null
  where s.ministry_id = g.ministry_id
    and (fn_leads_group(g.ministry_id, p_group) or fn_oversees(g.ministry_id))
  order by s.profile_id, s.as_of desc
$$;

-- Contact logs for the men currently in a group, for overseers. Never the note.
create or replace function group_contact_logs(p_group uuid)
returns table (profile_id uuid, leader_id uuid, contacted_at timestamptz, method contact_method)
language sql stable security definer set search_path = public as $$
  select cl.profile_id, cl.leader_id, cl.contacted_at, cl.method
  from contact_logs cl
  join groups g on g.id = p_group
  join group_members gm on gm.group_id = p_group and gm.profile_id = cl.profile_id and gm.left_at is null
  where cl.ministry_id = g.ministry_id
    and fn_oversees(g.ministry_id)
  order by cl.contacted_at desc
$$;

-- One group's prayer wall for overseers: group-only requests, anonymity kept,
-- men he blocked left out. Same columns as prayer_wall.
create or replace function group_prayer_wall(p_group uuid)
returns table (
  id uuid, body text, status prayer_status, visibility prayer_visibility, group_id uuid,
  is_anonymous boolean, answered_note text, created_at timestamptz,
  author_id uuid, author_name text, is_mine boolean,
  prayed_count int, i_prayed boolean, comment_count int)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.body, pr.status, pr.visibility, pr.group_id, pr.is_anonymous, pr.answered_note, pr.created_at,
    case when not pr.is_anonymous or pr.profile_id = auth.uid() then pr.profile_id end,
    case when not pr.is_anonymous or pr.profile_id = auth.uid() then p.full_name end,
    pr.profile_id = auth.uid(),
    (select count(*)::int from prayer_interactions i where i.prayer_request_id = pr.id and i.kind = 'prayed'),
    exists (select 1 from prayer_interactions i where i.prayer_request_id = pr.id and i.kind = 'prayed'
            and i.profile_id = auth.uid()),
    (select count(*)::int from prayer_interactions i where i.prayer_request_id = pr.id and i.kind = 'comment'
     and not fn_has_blocked(i.profile_id))
  from prayer_requests pr
  join profiles p on p.id = pr.profile_id
  where pr.group_id = p_group
    and pr.visibility = 'group'
    and pr.status <> 'archived'
    and fn_oversees(pr.ministry_id)
    and (pr.profile_id = auth.uid() or not fn_has_blocked(pr.profile_id))
  order by pr.created_at desc
$$;

-- Responses on a request: anyone who can see it as a man, and now overseers for
-- group requests. Otherwise unchanged from 0007.
create or replace function prayer_comments(p_request uuid)
returns table (id uuid, body text, author_id uuid, author_name text, is_mine boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.body, i.profile_id, p.full_name, i.profile_id = auth.uid(), i.created_at
  from prayer_interactions i
  join prayer_requests pr on pr.id = i.prayer_request_id
  join profiles p on p.id = i.profile_id
  where i.prayer_request_id = p_request and i.kind = 'comment'
    and (fn_can_see_prayer(pr.visibility, pr.ministry_id, pr.group_id)
         or (pr.visibility = 'group' and fn_oversees(pr.ministry_id)))
    and not fn_has_blocked(i.profile_id)
  order by i.created_at
$$;

-- Who the overseers are, for any member of the ministry (the privacy screen names them).
create or replace function ministry_overseers(p_ministry uuid)
returns table (profile_id uuid, full_name text)
language sql stable security definer set search_path = public as $$
  select mm.profile_id, p.full_name
  from ministry_members mm
  join profiles p on p.id = mm.profile_id
  where mm.ministry_id = p_ministry and mm.left_at is null
    and mm.role = 'admin' and mm.is_overseer
    and fn_ministry_role(p_ministry) is not null
  order by p.full_name
$$;

revoke execute on function fn_oversees(uuid)              from public, anon;
revoke execute on function group_contact_logs(uuid)       from public, anon;
revoke execute on function group_prayer_wall(uuid)        from public, anon;
revoke execute on function ministry_overseers(uuid)       from public, anon;
revoke execute on function group_tiers(uuid)              from public, anon;
revoke execute on function prayer_comments(uuid)          from public, anon;
grant execute on function fn_oversees(uuid), group_contact_logs(uuid), group_prayer_wall(uuid),
  ministry_overseers(uuid), group_tiers(uuid), prayer_comments(uuid) to authenticated;
