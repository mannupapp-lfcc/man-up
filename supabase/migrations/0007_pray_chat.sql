-- ============================================================
-- Man Up - Pray, group chat, reports, and blocks (0007_pray_chat.sql). Slice 6a.
-- Kevin reviews every policy and function here before push.
--
--   prayer_wall(ministry)        what the caller may see, author shown only when
--                                not anonymous (or his own), blocked men hidden
--   prayer_comments(request)     comments on a request he can see, with names
--   content_reports              report anything you can see; admins then see that
--                                one item while the report is open (privacy wall
--                                exception), and nothing else
--   resolve_report(report, rm)   admins dismiss or remove the reported content
--   user_blocks                  hides a man's content from the man who blocked him
-- Group chat joins the Realtime publication; Realtime applies the same RLS.
-- ============================================================

create type report_target as enum ('group_message', 'prayer_request', 'prayer_comment');
create type report_status as enum ('open', 'reviewed', 'actioned');

-- ---------- Prayer: testimony and one "I prayed" per man ----------
alter table prayer_requests add column answered_note text;
grant select (answered_note) on prayer_requests to authenticated;
grant update (answered_note) on prayer_requests to authenticated;

create unique index prayer_interactions_one_prayed
  on prayer_interactions (prayer_request_id, profile_id) where kind = 'prayed';

-- ---------- Blocks ----------
create table user_blocks (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  blocker_id uuid not null references profiles(id),
  blocked_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (ministry_id, blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table user_blocks enable row level security;

-- A member cannot read other men's membership rows, so "is the blocked man in this
-- ministry" needs a definer helper.
create or replace function fn_is_ministry_member(p_ministry uuid, p_profile uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ministry_members
                 where ministry_id = p_ministry and profile_id = p_profile)
$$;

create policy "user_blocks: own" on user_blocks
  for all to authenticated
  using (blocker_id = auth.uid() and fn_ministry_role(ministry_id) is not null)
  with check (blocker_id = auth.uid() and fn_ministry_role(ministry_id) is not null
              and fn_is_ministry_member(ministry_id, blocked_id));
-- Admins are told a block happened (product map); they never see content through it.
create policy "user_blocks: admins read" on user_blocks
  for select to authenticated
  using (fn_is_admin(ministry_id));

create or replace function fn_has_blocked(p_profile uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_blocks where blocker_id = auth.uid() and blocked_id = p_profile)
$$;

-- ---------- Reports ----------
create table content_reports (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  reporter_id uuid not null references profiles(id),
  target_type report_target not null,
  target_id uuid not null,
  reason text,
  status report_status not null default 'open',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table content_reports enable row level security;
create index on content_reports (target_type, target_id) where status = 'open';

-- A man can report only something he can see: the subqueries run under his own RLS.
create policy "content_reports: report what you can see" on content_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid() and status = 'open' and reviewed_by is null
    and fn_ministry_role(ministry_id) is not null
    and case target_type
      when 'group_message' then exists (select 1 from group_messages m
        where m.id = content_reports.target_id and m.ministry_id = content_reports.ministry_id)
      when 'prayer_request' then exists (select 1 from prayer_requests p
        where p.id = content_reports.target_id and p.ministry_id = content_reports.ministry_id)
      when 'prayer_comment' then exists (select 1 from prayer_interactions i
        where i.id = content_reports.target_id and i.ministry_id = content_reports.ministry_id and i.kind = 'comment')
    end);
create policy "content_reports: own reports" on content_reports
  for select to authenticated
  using (reporter_id = auth.uid());
create policy "content_reports: admins read" on content_reports
  for select to authenticated
  using (fn_is_admin(ministry_id));

-- True when an open report targets this item. SECURITY DEFINER so the chat and
-- prayer policies below can use it without depending on content_reports' own RLS.
create or replace function fn_open_report(p_type report_target, p_target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from content_reports
                 where target_type = p_type and target_id = p_target and status = 'open')
$$;

-- ---------- Group chat: blocks, and the report exception ----------
drop policy "group_messages: current group members read" on group_messages;
create policy "group_messages: current group members read" on group_messages
  for select to authenticated
  using (fn_in_group(ministry_id, group_id) and not fn_has_blocked(profile_id));
-- The privacy wall's one exception: admins see a reported message while the report
-- is open. Only that message, never the thread.
create policy "group_messages: admins read open reports" on group_messages
  for select to authenticated
  using (fn_is_admin(ministry_id) and fn_open_report('group_message', id));

create policy "prayer_requests: admins read open reports" on prayer_requests
  for select to authenticated
  using (fn_is_admin(ministry_id) and fn_open_report('prayer_request', id));
create policy "prayer_interactions: admins read open reports" on prayer_interactions
  for select to authenticated
  using (fn_is_admin(ministry_id) and fn_open_report('prayer_comment', id));

-- ---------- Moderation ----------
-- Dismiss (reviewed) or remove the content (actioned). Removing a prayer request
-- also removes its prayers and comments.
create or replace function resolve_report(p_report uuid, p_remove boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v content_reports%rowtype;
begin
  select * into v from content_reports where id = p_report for update;
  if not found or not fn_is_admin(v.ministry_id) then
    raise exception 'Only a ministry admin can resolve this report.' using errcode = '42501';
  end if;

  if p_remove then
    if v.target_type = 'group_message' then
      delete from group_messages where id = v.target_id and ministry_id = v.ministry_id;
    elsif v.target_type = 'prayer_comment' then
      delete from prayer_interactions where id = v.target_id and ministry_id = v.ministry_id;
    else
      delete from prayer_interactions where prayer_request_id = v.target_id and ministry_id = v.ministry_id;
      delete from prayer_requests where id = v.target_id and ministry_id = v.ministry_id;
    end if;
  end if;

  -- Every open report on the same item is resolved together.
  update content_reports
  set status = case when p_remove then 'actioned' else 'reviewed' end::report_status,
      reviewed_by = auth.uid(), reviewed_at = now()
  where target_type = v.target_type and target_id = v.target_id and status = 'open';
end $$;

-- ---------- Prayer reads with names (anonymity kept) ----------
create or replace function fn_can_see_prayer(p_visibility prayer_visibility, p_ministry uuid, p_group uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select (p_visibility = 'group' and fn_in_group(p_ministry, p_group))
      or (p_visibility = 'ministry' and fn_ministry_role(p_ministry) is not null)
$$;

create or replace function prayer_wall(p_ministry uuid)
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
  where pr.ministry_id = p_ministry
    and pr.status <> 'archived'
    and fn_can_see_prayer(pr.visibility, pr.ministry_id, pr.group_id)
    and (pr.profile_id = auth.uid() or not fn_has_blocked(pr.profile_id))
  order by pr.created_at desc
$$;

create or replace function prayer_comments(p_request uuid)
returns table (id uuid, body text, author_id uuid, author_name text, is_mine boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.body, i.profile_id, p.full_name, i.profile_id = auth.uid(), i.created_at
  from prayer_interactions i
  join prayer_requests pr on pr.id = i.prayer_request_id
  join profiles p on p.id = i.profile_id
  where i.prayer_request_id = p_request and i.kind = 'comment'
    and fn_can_see_prayer(pr.visibility, pr.ministry_id, pr.group_id)
    and not fn_has_blocked(i.profile_id)
  order by i.created_at
$$;

-- ---------- Realtime for group chat (RLS applies to subscribers) ----------
alter publication supabase_realtime add table group_messages;

-- ---------- Grants ----------
revoke execute on function fn_has_blocked(uuid)                                     from public, anon;
revoke execute on function fn_is_ministry_member(uuid, uuid)                        from public, anon;
revoke execute on function fn_open_report(report_target, uuid)                      from public, anon;
revoke execute on function fn_can_see_prayer(prayer_visibility, uuid, uuid)         from public, anon;
revoke execute on function resolve_report(uuid, boolean)                            from public, anon;
revoke execute on function prayer_wall(uuid)                                        from public, anon;
revoke execute on function prayer_comments(uuid)                                    from public, anon;
revoke all on user_blocks, content_reports from anon;
