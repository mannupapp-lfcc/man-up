-- ============================================================
-- Man Up - Full RLS policy set (0002_rls.sql). Build order slice 2.
-- Kevin reviews every policy here before `supabase db push`.
--
-- Rules applied throughout:
--   * Every policy is TO authenticated and filters on ministry_id through the
--     fn_* helpers. No role logic is inlined in a policy.
--   * Tenancy: nothing crosses ministry_id. Group scope: nothing crosses group_id.
--   * Privacy wall: prayer, chat, reflections, and contact notes are never readable
--     by admins by virtue of being admins. (The content_reports exception arrives
--     with that table.)
--   * Scores: members never read member_scores or leader_scores.
--   * Writes done by server jobs (scores, PCO mirror, Sanity mirror, meetings
--     generation) have no client policy; the service role bypasses RLS.
-- ============================================================

-- ---------- Schema change the policies depend on ----------
-- The prayer wall is scoped to the group where the request was shared (product map
-- 3.4 and the privacy wall). Backfill from the author's current group.
alter table prayer_requests add column group_id uuid references groups(id);
update prayer_requests pr set group_id = (
  select gm.group_id from group_members gm
  where gm.profile_id = pr.profile_id and gm.ministry_id = pr.ministry_id
  order by gm.left_at is null desc, gm.joined_at desc
  limit 1);
alter table prayer_requests alter column group_id set not null;

-- ---------- Anonymous role: no table access at all ----------
-- Every app read happens after sign-in. RLS would already return nothing to anon;
-- this removes the grants so a missing policy can never leak to signed-out callers.
revoke all on all tables in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;

-- ---------- Group-scope helpers (same pattern as fn_ministry_role) ----------
-- SECURITY DEFINER so policies on group_members can use them without recursion.
-- Each one also requires current membership in the ministry, so leaving the
-- ministry removes group access even if a group_members row lingers.

-- Caller is a current member of the group.
create or replace function fn_in_group(p_ministry uuid, p_group uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select fn_ministry_role(p_ministry) is not null and exists (
    select 1 from group_members gm
    where gm.ministry_id = p_ministry and gm.group_id = p_group
      and gm.profile_id = auth.uid() and gm.left_at is null)
$$;

-- Caller currently leads (leader or co-leader) the group.
create or replace function fn_leads_group(p_ministry uuid, p_group uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select fn_is_leader(p_ministry) and exists (
    select 1 from group_members gm
    where gm.ministry_id = p_ministry and gm.group_id = p_group
      and gm.profile_id = auth.uid() and gm.is_group_leader and gm.left_at is null)
$$;

-- Caller currently leads a group the man is currently in.
create or replace function fn_leads_member(p_ministry uuid, p_profile uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select fn_is_leader(p_ministry) and exists (
    select 1 from group_members l
    join group_members m on m.group_id = l.group_id
    where l.ministry_id = p_ministry and m.ministry_id = p_ministry
      and l.profile_id = auth.uid() and l.is_group_leader and l.left_at is null
      and m.profile_id = p_profile and m.left_at is null)
$$;

-- profiles has no ministry_id (a man belongs to an organization once). Readable if:
-- it is the caller, or they share a current group in a ministry the caller is in,
-- or the caller is an admin of a ministry the man currently belongs to.
create or replace function fn_can_read_profile(p_profile uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_profile = auth.uid()
    or exists (
      select 1 from group_members me
      join group_members them on them.group_id = me.group_id
      where me.profile_id = auth.uid() and me.left_at is null
        and them.profile_id = p_profile and them.left_at is null
        and fn_ministry_role(me.ministry_id) is not null)
    or exists (
      select 1 from ministry_members mm
      where mm.profile_id = p_profile and mm.left_at is null
        and fn_is_admin(mm.ministry_id))
$$;

-- ---------- Replace the 0001 starter policies ----------
-- Several used fn_is_leader(ministry_id) alone, which let any co-leader read contact
-- logs and scores for men in every group. Leaders are scoped to their own group.
drop policy "own profile read" on profiles;
drop policy "own profile update" on profiles;
drop policy "groups visible to ministry members" on groups;
drop policy "chat visible to current group members" on group_messages;
drop policy "contact logs: ministry leaders only" on contact_logs;
drop policy "own lesson progress" on lesson_progress;
drop policy "member scores: leaders only" on member_scores;
drop policy "own push tokens" on push_tokens;

-- ============================================================
-- Tenancy
-- ============================================================
create policy "organizations: members of one of its ministries" on organizations
  for select to authenticated
  using (exists (select 1 from ministries mi
                 where mi.organization_id = organizations.id
                   and fn_ministry_role(mi.id) is not null));

create policy "ministries: members" on ministries
  for select to authenticated
  using (fn_ministry_role(id) is not null);

create policy "ministry_config: members read" on ministry_config
  for select to authenticated
  using (fn_ministry_role(ministry_id) is not null);
create policy "ministry_config: admins write" on ministry_config
  for all to authenticated
  using (fn_is_admin(ministry_id)) with check (fn_is_admin(ministry_id));

-- ============================================================
-- People
-- ============================================================
create policy "profiles: self, group mates, ministry admins" on profiles
  for select to authenticated
  using (fn_can_read_profile(id));
-- Column grants below limit this to name, phone, email, photo. pco_person_id is set
-- only by an admin confirming a PCO match (server side), never by the man himself.
create policy "profiles: update own" on profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

revoke update on profiles from authenticated;
grant update (full_name, phone, email, photo_url) on profiles to authenticated;

create policy "ministry_members: own rows" on ministry_members
  for select to authenticated
  using (profile_id = auth.uid());
create policy "ministry_members: leaders see their men" on ministry_members
  for select to authenticated
  using (fn_leads_member(ministry_id, profile_id));
create policy "ministry_members: admins manage" on ministry_members
  for all to authenticated
  using (fn_is_admin(ministry_id)) with check (fn_is_admin(ministry_id));

-- Redemption happens through a server-side function in slice 3, not direct reads.
create policy "invite_codes: admins manage" on invite_codes
  for all to authenticated
  using (fn_is_admin(ministry_id)) with check (fn_is_admin(ministry_id));

-- ============================================================
-- Groups, meetings, attendance
-- ============================================================
create policy "groups: ministry members read" on groups
  for select to authenticated
  using (fn_ministry_role(ministry_id) is not null);
create policy "groups: admins manage" on groups
  for all to authenticated
  using (fn_is_admin(ministry_id)) with check (fn_is_admin(ministry_id));

-- Roster changes are admin-only (leaders request, admins approve).
create policy "group_members: group mates read" on group_members
  for select to authenticated
  using (fn_in_group(ministry_id, group_id));
create policy "group_members: admins manage" on group_members
  for all to authenticated
  using (fn_is_admin(ministry_id)) with check (fn_is_admin(ministry_id));

create policy "meetings: group members read" on meetings
  for select to authenticated
  using (fn_in_group(ministry_id, group_id) or fn_is_admin(ministry_id));
-- Meetings are generated by a job. Leaders only mark them (column grant below).
create policy "meetings: group leaders mark" on meetings
  for update to authenticated
  using (fn_leads_group(ministry_id, group_id) or fn_is_admin(ministry_id))
  with check (fn_leads_group(ministry_id, group_id) or fn_is_admin(ministry_id));
create policy "meetings: admins insert" on meetings
  for insert to authenticated
  with check (fn_is_admin(ministry_id));
create policy "meetings: admins delete" on meetings
  for delete to authenticated
  using (fn_is_admin(ministry_id));

revoke update on meetings from authenticated;
grant update (attendance_marked_at) on meetings to authenticated;

-- The 72-hour gate depends on attendance_marked_at being honest. When a signed-in
-- user marks a meeting, the server clock sets the value, and it never moves after.
-- Server jobs (service role) and seeds are unaffected.
create or replace function fn_stamp_attendance_marked()
returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user = 'authenticated'
     and new.attendance_marked_at is distinct from old.attendance_marked_at then
    new.attendance_marked_at := coalesce(old.attendance_marked_at,
                                         case when new.attendance_marked_at is not null then now() end);
  end if;
  return new;
end $$;

create trigger meetings_stamp_attendance_marked
  before update of attendance_marked_at on meetings
  for each row execute function fn_stamp_attendance_marked();

-- A man sees only his own attendance; his group leaders see the group's.
create policy "meeting_attendance: own" on meeting_attendance
  for select to authenticated
  using (profile_id = auth.uid() and fn_ministry_role(ministry_id) is not null);
create policy "meeting_attendance: group leaders and admins read" on meeting_attendance
  for select to authenticated
  using (exists (select 1 from meetings mt
                 where mt.id = meeting_attendance.meeting_id
                   and mt.ministry_id = meeting_attendance.ministry_id
                   and (fn_leads_group(mt.ministry_id, mt.group_id)
                        or fn_is_admin(mt.ministry_id))));
create policy "meeting_attendance: group leaders mark" on meeting_attendance
  for insert to authenticated
  with check (
    marked_by = auth.uid()
    and exists (select 1 from meetings mt
                join group_members gm on gm.group_id = mt.group_id
                where mt.id = meeting_attendance.meeting_id
                  and mt.ministry_id = meeting_attendance.ministry_id
                  and gm.profile_id = meeting_attendance.profile_id
                  and (fn_leads_group(mt.ministry_id, mt.group_id)
                       or fn_is_admin(mt.ministry_id))));
create policy "meeting_attendance: group leaders correct" on meeting_attendance
  for update to authenticated
  using (exists (select 1 from meetings mt
                 where mt.id = meeting_attendance.meeting_id
                   and mt.ministry_id = meeting_attendance.ministry_id
                   and (fn_leads_group(mt.ministry_id, mt.group_id)
                        or fn_is_admin(mt.ministry_id))))
  with check (
    marked_by = auth.uid()
    and exists (select 1 from meetings mt
                join group_members gm on gm.group_id = mt.group_id
                where mt.id = meeting_attendance.meeting_id
                  and mt.ministry_id = meeting_attendance.ministry_id
                  and gm.profile_id = meeting_attendance.profile_id
                  and (fn_leads_group(mt.ministry_id, mt.group_id)
                       or fn_is_admin(mt.ministry_id))));

-- ============================================================
-- Gatherings (Church Center owns check-in for LFCC)
-- ============================================================
create policy "gatherings: ministry members read" on gatherings
  for select to authenticated
  using (fn_ministry_role(ministry_id) is not null);
create policy "gatherings: admins manage" on gatherings
  for all to authenticated
  using (fn_is_admin(ministry_id)) with check (fn_is_admin(ministry_id));

create policy "gathering_checkins: own and admins read" on gathering_checkins
  for select to authenticated
  using ((profile_id = auth.uid() and fn_ministry_role(ministry_id) is not null)
         or fn_is_admin(ministry_id));
-- Only for tenants with attendance_source = 'in_app'. LFCC is 'pco', so this never
-- opens for Man Up (Non-negotiable 7).
create policy "gathering_checkins: self check-in for in_app tenants" on gathering_checkins
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and fn_ministry_role(ministry_id) is not null
    and exists (select 1 from ministry_config c
                where c.ministry_id = gathering_checkins.ministry_id
                  and c.key = 'attendance_source' and c.value = '"in_app"'::jsonb)
    and exists (select 1 from gatherings g
                where g.id = gathering_checkins.gathering_id
                  and g.ministry_id = gathering_checkins.ministry_id));

-- ============================================================
-- PCO read mirror: written only by the nightly sync. Admins read (Match queue).
-- ============================================================
create policy "pco_roster: admins read" on pco_roster
  for select to authenticated using (fn_is_admin(ministry_id));
create policy "pco_gathering_attendance: admins read" on pco_gathering_attendance
  for select to authenticated using (fn_is_admin(ministry_id));
create policy "pco_sync_log: admins read" on pco_sync_log
  for select to authenticated using (fn_is_admin(ministry_id));
create policy "pco_match_log: admins read" on pco_match_log
  for select to authenticated using (fn_is_admin(ministry_id));

-- ============================================================
-- Pray: visible only inside the group where it was shared. No admin browse.
-- ============================================================
create policy "prayer_requests: group members read" on prayer_requests
  for select to authenticated
  using (fn_in_group(ministry_id, group_id));
create policy "prayer_requests: post to own group" on prayer_requests
  for insert to authenticated
  with check (profile_id = auth.uid() and fn_in_group(ministry_id, group_id));
create policy "prayer_requests: author updates" on prayer_requests
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid() and fn_in_group(ministry_id, group_id));
create policy "prayer_requests: author deletes" on prayer_requests
  for delete to authenticated
  using (profile_id = auth.uid());

-- Anonymous posts: RLS cannot hide a column per row, so profile_id is not readable
-- by clients at all. The Pray slice adds a view that returns the author only for
-- non-anonymous posts (and flags the caller's own posts).
revoke select, update on prayer_requests from authenticated;
grant select (id, ministry_id, group_id, body, is_anonymous, status, created_at)
  on prayer_requests to authenticated;
grant update (body, status, is_anonymous) on prayer_requests to authenticated;

create policy "prayer_interactions: group members read" on prayer_interactions
  for select to authenticated
  using (exists (select 1 from prayer_requests pr
                 where pr.id = prayer_interactions.prayer_request_id
                   and pr.ministry_id = prayer_interactions.ministry_id
                   and fn_in_group(pr.ministry_id, pr.group_id)));
create policy "prayer_interactions: group members add own" on prayer_interactions
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from prayer_requests pr
                where pr.id = prayer_interactions.prayer_request_id
                  and pr.ministry_id = prayer_interactions.ministry_id
                  and fn_in_group(pr.ministry_id, pr.group_id)));
create policy "prayer_interactions: delete own" on prayer_interactions
  for delete to authenticated
  using (profile_id = auth.uid());

-- ============================================================
-- Group chat: current members of that group only. No admin browse.
-- ============================================================
create policy "group_messages: current group members read" on group_messages
  for select to authenticated
  using (fn_in_group(ministry_id, group_id));
create policy "group_messages: current group members post own" on group_messages
  for insert to authenticated
  with check (profile_id = auth.uid() and fn_in_group(ministry_id, group_id));
create policy "group_messages: delete own" on group_messages
  for delete to authenticated
  using (profile_id = auth.uid());

-- ============================================================
-- Courses: mirrored from Sanity by the webhook route (service role).
-- ============================================================
create policy "courses: members read published" on courses
  for select to authenticated
  using (is_published and fn_ministry_role(ministry_id) is not null);
create policy "lessons: members read lessons of published courses" on lessons
  for select to authenticated
  using (fn_ministry_role(ministry_id) is not null
         and exists (select 1 from courses c
                     where c.id = lessons.course_id and c.ministry_id = lessons.ministry_id
                       and c.is_published));

-- Reflections are private to the man. No leader or admin read; completion counts
-- reach scoring through the server job, never through a client read.
create policy "lesson_progress: own" on lesson_progress
  for all to authenticated
  using (profile_id = auth.uid() and fn_ministry_role(ministry_id) is not null)
  with check (
    profile_id = auth.uid()
    and fn_ministry_role(ministry_id) is not null
    and exists (select 1 from lessons l
                where l.id = lesson_progress.lesson_id
                  and l.ministry_id = lesson_progress.ministry_id));

-- sanity_sync_log: no client access (server only; it has no ministry_id).

-- ============================================================
-- Serve
-- ============================================================
create policy "serve_opportunities: ministry members read" on serve_opportunities
  for select to authenticated
  using (fn_ministry_role(ministry_id) is not null);
create policy "serve_opportunities: admins manage" on serve_opportunities
  for all to authenticated
  using (fn_is_admin(ministry_id)) with check (fn_is_admin(ministry_id));

create policy "serve_logs: own, group leaders, admins read" on serve_logs
  for select to authenticated
  using ((profile_id = auth.uid() and fn_ministry_role(ministry_id) is not null)
         or fn_leads_member(ministry_id, profile_id)
         or fn_is_admin(ministry_id));
-- Participation is confirmed by the man's group leader or an admin.
create policy "serve_logs: group leaders and admins confirm" on serve_logs
  for insert to authenticated
  with check (
    logged_by = auth.uid()
    and (fn_leads_member(ministry_id, profile_id) or fn_is_admin(ministry_id))
    and (opportunity_id is null
         or exists (select 1 from serve_opportunities o
                    where o.id = serve_logs.opportunity_id
                      and o.ministry_id = serve_logs.ministry_id)));
create policy "serve_logs: confirmer or admin deletes" on serve_logs
  for delete to authenticated
  using ((logged_by = auth.uid() and fn_is_leader(ministry_id)) or fn_is_admin(ministry_id));

-- ============================================================
-- Shepherding contacts: the man's current group leaders only.
-- Not members, not admins (notes stay between the leader and the man; coverage
-- counts reach the admin dashboard through the scoring job).
-- ============================================================
create policy "contact_logs: author and the man's group leaders read" on contact_logs
  for select to authenticated
  using ((leader_id = auth.uid() and fn_is_leader(ministry_id))
         or fn_leads_member(ministry_id, profile_id));
create policy "contact_logs: group leaders log" on contact_logs
  for insert to authenticated
  with check (leader_id = auth.uid() and fn_leads_member(ministry_id, profile_id));
create policy "contact_logs: author edits" on contact_logs
  for update to authenticated
  using (leader_id = auth.uid() and fn_is_leader(ministry_id))
  with check (leader_id = auth.uid() and fn_leads_member(ministry_id, profile_id));
create policy "contact_logs: author deletes" on contact_logs
  for delete to authenticated
  using (leader_id = auth.uid() and fn_is_leader(ministry_id));

-- ============================================================
-- Scoring: rows written only by the Sunday night job (service role).
-- ============================================================
create policy "score_config: admins manage" on score_config
  for all to authenticated
  using (fn_is_admin(ministry_id)) with check (fn_is_admin(ministry_id));

-- Members never read scores, including their own (Non-negotiable 5). Leaders read
-- their own group's men. Tier-only exposure is shaped in the scoring slice.
create policy "member_scores: group leaders and admins read" on member_scores
  for select to authenticated
  using (fn_leads_member(ministry_id, profile_id) or fn_is_admin(ministry_id));

create policy "leader_scores: admins read" on leader_scores
  for select to authenticated
  using (fn_is_admin(ministry_id));

-- ============================================================
-- Push tokens
-- ============================================================
create policy "push_tokens: own" on push_tokens
  for all to authenticated
  using (profile_id = auth.uid() and fn_ministry_role(ministry_id) is not null)
  with check (profile_id = auth.uid() and fn_ministry_role(ministry_id) is not null);
