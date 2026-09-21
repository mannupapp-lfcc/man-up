-- ============================================================
-- Man Up - Prayer visibility (0005_prayer_visibility.sql).
--
-- The author chooses who sees a prayer request:
--   group     only the current members of his group (default; same as before)
--   ministry  every current member of his ministry (all groups, leaders, admins)
-- Nothing ever crosses ministry_id. Anonymous posts keep the author hidden in both
-- (profile_id stays unreadable to clients, see 0002). A man with no group can
-- still share ministry-wide.
-- Kevin reviews these policy changes before push.
-- ============================================================

create type prayer_visibility as enum ('group', 'ministry');

alter table prayer_requests add column visibility prayer_visibility not null default 'group';

-- A ministry-wide request does not need a group; a group request always has one.
alter table prayer_requests alter column group_id drop not null;
alter table prayer_requests add constraint prayer_requests_group_visibility_check
  check (visibility <> 'group' or group_id is not null);

-- ---------- prayer_requests ----------
drop policy "prayer_requests: group members read" on prayer_requests;
drop policy "prayer_requests: post to own group" on prayer_requests;
drop policy "prayer_requests: author updates" on prayer_requests;

create policy "prayer_requests: group or ministry, as the author chose" on prayer_requests
  for select to authenticated
  using ((visibility = 'group' and fn_in_group(ministry_id, group_id))
         or (visibility = 'ministry' and fn_ministry_role(ministry_id) is not null));

-- He posts as himself, in his own ministry. A group is optional for ministry-wide
-- posts, but any group named must be his current group.
create policy "prayer_requests: post as self" on prayer_requests
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and fn_ministry_role(ministry_id) is not null
    and (group_id is null or fn_in_group(ministry_id, group_id)));

create policy "prayer_requests: author updates" on prayer_requests
  for update to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and fn_ministry_role(ministry_id) is not null
    and (group_id is null or fn_in_group(ministry_id, group_id)));

grant select (visibility) on prayer_requests to authenticated;
-- He can widen or narrow a request after posting (narrowing needs his group_id).
grant update (visibility, group_id) on prayer_requests to authenticated;

-- ---------- prayer_interactions ----------
-- Whoever can see a request can pray for it and respond. The subquery runs under
-- the caller's own prayer_requests policy, so the two can never drift apart.
drop policy "prayer_interactions: group members read" on prayer_interactions;
drop policy "prayer_interactions: group members add own" on prayer_interactions;

create policy "prayer_interactions: readers of the request" on prayer_interactions
  for select to authenticated
  using (exists (select 1 from prayer_requests pr
                 where pr.id = prayer_interactions.prayer_request_id
                   and pr.ministry_id = prayer_interactions.ministry_id));

create policy "prayer_interactions: readers of the request add own" on prayer_interactions
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from prayer_requests pr
                where pr.id = prayer_interactions.prayer_request_id
                  and pr.ministry_id = prayer_interactions.ministry_id));
