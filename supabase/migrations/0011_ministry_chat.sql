-- ============================================================
-- Man Up - Ministry chat (0011_ministry_chat.sql).
-- Kevin reviews every policy and function here before push.
--
-- One chat for every man in the ministry, beside the group chats.
--   ministry_messages          any current member reads and posts; blocked men hidden;
--                              he deletes his own. Posting goes through
--                              post_ministry_message so tags and alerts are validated.
--   ministry_message_alerts    who gets a push for a message: everyone when a leader
--                              posts, and any man tagged. No client access; the push
--                              sender (slice 9) drains it with the service role and
--                              reads the text from the message at send time, so a
--                              deleted message is never pushed.
--   ministry_people(ministry)  names for chat and the tag picker
--   report_target              gains 'ministry_message'; the reports path and
--                              resolve_report cover it like group chat.
-- Scoring counts a post as activity (never its content), same as group chat.
-- ============================================================

-- ---------- report_target gains 'ministry_message' ----------
-- Rebuilt rather than ALTER TYPE ... ADD VALUE: a value added that way cannot be used
-- in the same transaction, and pnpm test:db applies pending migrations and runs the
-- tests in one. The policies and function that depend on the type are dropped and
-- recreated unchanged (except the new branch in the report insert policy).
alter type report_target rename to report_target_0007;
create type report_target as enum ('group_message', 'prayer_request', 'prayer_comment', 'ministry_message');

drop policy "content_reports: report what you can see" on content_reports;
drop policy "group_messages: admins read open reports" on group_messages;
drop policy "prayer_requests: admins read open reports" on prayer_requests;
drop policy "prayer_interactions: admins read open reports" on prayer_interactions;
drop function fn_open_report(report_target_0007, uuid);

alter table content_reports
  alter column target_type type report_target using target_type::text::report_target;
drop type report_target_0007;

create or replace function fn_open_report(p_type report_target, p_target uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from content_reports
                 where target_type = p_type and target_id = p_target and status = 'open')
$$;

create policy "group_messages: admins read open reports" on group_messages
  for select to authenticated
  using (fn_is_admin(ministry_id) and fn_open_report('group_message', id));
create policy "prayer_requests: admins read open reports" on prayer_requests
  for select to authenticated
  using (fn_is_admin(ministry_id) and fn_open_report('prayer_request', id));
create policy "prayer_interactions: admins read open reports" on prayer_interactions
  for select to authenticated
  using (fn_is_admin(ministry_id) and fn_open_report('prayer_comment', id));

-- ---------- Ministry chat ----------
create table ministry_messages (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id),
  body text not null check (length(btrim(body)) between 1 and 2000),
  -- Men tagged in this message (validated by post_ministry_message).
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table ministry_messages enable row level security;
create index on ministry_messages (ministry_id, created_at desc);

-- Every current member of the ministry reads it (admins too: they are in the room,
-- unlike group chat). A man he has blocked disappears for him.
create policy "ministry_messages: current members read" on ministry_messages
  for select to authenticated
  using (fn_ministry_role(ministry_id) is not null
         and (profile_id = auth.uid() or not fn_has_blocked(profile_id)));
create policy "ministry_messages: delete own" on ministry_messages
  for delete to authenticated
  using (profile_id = auth.uid() and fn_ministry_role(ministry_id) is not null);
-- No insert or update policy: posting goes through post_ministry_message.

-- ---------- Alerts (push queue; no client access) ----------
create type ministry_alert_kind as enum ('leader_post', 'mention');

create table ministry_message_alerts (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  message_id uuid not null references ministry_messages(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  kind ministry_alert_kind not null,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, profile_id)
);
alter table ministry_message_alerts enable row level security;
create index on ministry_message_alerts (created_at) where sent_at is null;
-- RLS on with no policies: signed-in users read and write nothing here.
revoke all on ministry_message_alerts from anon;

-- ---------- Posting ----------
-- Inserts the message, keeps only tags of current ministry members (not himself, at
-- most 10), and queues alerts: a tag always alerts that man; a leader's post alerts
-- every current member. A man who blocked the author is never alerted.
create or replace function post_ministry_message(p_ministry uuid, p_body text, p_mentions uuid[] default '{}')
returns ministry_messages
language plpgsql security definer set search_path = public as $$
declare
  v_msg ministry_messages%rowtype;
  v_mentions uuid[];
begin
  if fn_ministry_role(p_ministry) is null then
    raise exception 'Only members of this ministry can post here.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Write a message first.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct mm.profile_id), '{}') into v_mentions
  from ministry_members mm
  where mm.ministry_id = p_ministry and mm.left_at is null
    and mm.profile_id = any (coalesce(p_mentions, '{}'))
    and mm.profile_id <> auth.uid();
  if cardinality(v_mentions) > 10 then
    raise exception 'Tag at most 10 men in one message.' using errcode = '22023';
  end if;

  insert into ministry_messages (ministry_id, profile_id, body, mentions)
  values (p_ministry, auth.uid(), btrim(p_body), v_mentions)
  returning * into v_msg;

  insert into ministry_message_alerts (ministry_id, message_id, profile_id, kind)
  select p_ministry, v_msg.id, mm.profile_id,
         case when mm.profile_id = any (v_mentions) then 'mention' else 'leader_post' end::ministry_alert_kind
  from ministry_members mm
  where mm.ministry_id = p_ministry and mm.left_at is null
    and mm.profile_id <> auth.uid()
    and (mm.profile_id = any (v_mentions) or fn_is_leader(p_ministry))
    and not exists (select 1 from user_blocks b
                    where b.ministry_id = p_ministry and b.blocker_id = mm.profile_id
                      and b.blocked_id = auth.uid());

  return v_msg;
end $$;

-- Names for the chat and the tag picker. A member cannot read profiles outside his
-- group, so this definer function returns only name and whether he leads, for
-- current members of a ministry the caller belongs to.
create or replace function ministry_people(p_ministry uuid)
returns table (profile_id uuid, full_name text, is_leader boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, mm.role in ('co_leader', 'leader', 'admin')
  from ministry_members mm
  join profiles p on p.id = mm.profile_id
  where mm.ministry_id = p_ministry and mm.left_at is null
    and fn_ministry_role(p_ministry) is not null
  order by p.full_name
$$;

-- ---------- Reports cover ministry chat ----------
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
      when 'ministry_message' then exists (select 1 from ministry_messages mm
        where mm.id = content_reports.target_id and mm.ministry_id = content_reports.ministry_id)
    end);

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
    elsif v.target_type = 'ministry_message' then
      delete from ministry_messages where id = v.target_id and ministry_id = v.ministry_id;
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

-- ---------- Realtime (RLS applies to subscribers) ----------
alter publication supabase_realtime add table ministry_messages;

-- ---------- Grants ----------
revoke all on ministry_messages from anon;
revoke insert, update on ministry_messages from authenticated;
revoke execute on function fn_open_report(report_target, uuid)             from public, anon;
revoke execute on function post_ministry_message(uuid, text, uuid[])       from public, anon;
revoke execute on function ministry_people(uuid)                           from public, anon;
revoke execute on function resolve_report(uuid, boolean)                   from public, anon;
