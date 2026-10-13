-- ============================================================
-- Man Up - Ministry chat pushes (0016_ministry_chat_push.sql).
-- Kevin reviews this function before push. No RLS policy changes.
--
-- A man can opt in to a push for every ministry chat message, not only tags and
-- @everyone. Off unless he turns it on (a missing settings row means off here).
--   push_kind                  gains 'ministry_message' (an ordinary chat message)
--   notification_settings      gains ministry_chat (default off)
--   post_ministry_message      same as 0013, then queues 'ministry_message' rows in
--                              push_outbox for men who opted in and were not already
--                              alerted. Tags and
--                              @everyone go through ministry_message_alerts as before
--                              and land in the outbox first (same dedupe key), so a
--                              tagged man gets one push, as a tag, which he cannot mute.
-- A man who blocked the author is never pushed. Chat rows carry no text: the sender
-- reads the message at send time, so a deleted message is never pushed.
-- ============================================================

-- ---------- push_kind gains 'ministry_message' ----------
-- Rebuilt rather than ALTER TYPE ... ADD VALUE: a value added that way cannot be used
-- in the same transaction, and pnpm test:db applies pending migrations and runs the
-- tests in one. No policy depends on the type; the trigger functions cast at run time.
alter type push_kind rename to push_kind_0014;
create type push_kind as enum (
  'group_message', 'ministry_mention', 'ministry_post', 'ministry_message',
  'meeting_reminder', 'attendance_prompt', 'weekly_questions', 'checkin_prompt', 'leader_digest'
);
alter table push_outbox alter column kind type push_kind using kind::text::push_kind;
drop type push_kind_0014;

-- ---------- Setting ----------
alter table notification_settings add column ministry_chat boolean not null default false;

-- ---------- Posting ----------
create or replace function post_ministry_message(p_ministry uuid, p_body text, p_mentions uuid[] default '{}')
returns ministry_messages
language plpgsql security definer set search_path = public as $$
declare
  v_msg ministry_messages%rowtype;
  v_mentions uuid[];
  v_everyone boolean := coalesce(p_body, '') ~* '(^|[^[:alnum:]_@])@everyone([^[:alnum:]_]|$)';
begin
  if fn_ministry_role(p_ministry) is null then
    raise exception 'Only members of this ministry can post here.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Write a message first.' using errcode = '22023';
  end if;

  if v_everyone and not fn_is_leader(p_ministry) then
    raise exception 'Only admins and leaders can use @everyone.' using errcode = '42501';
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
    and (mm.profile_id = any (v_mentions) or v_everyone)
    and not exists (select 1 from user_blocks b
                    where b.ministry_id = p_ministry and b.blocker_id = mm.profile_id
                      and b.blocked_id = auth.uid());

  -- Men who opted in hear about it as an ordinary message. The alerts above are
  -- already in the outbox under the same dedupe key, so they keep their kind.
  insert into push_outbox (ministry_id, profile_id, kind, ref_id, dedupe_key)
  select p_ministry, mm.profile_id, 'ministry_message', v_msg.id, 'ministry_message:' || v_msg.id
  from ministry_members mm
  join notification_settings ns on ns.ministry_id = mm.ministry_id and ns.profile_id = mm.profile_id
  where mm.ministry_id = p_ministry and mm.left_at is null
    and mm.profile_id <> auth.uid()
    and ns.ministry_chat
    and not exists (select 1 from user_blocks b
                    where b.ministry_id = p_ministry and b.blocker_id = mm.profile_id
                      and b.blocked_id = auth.uid())
  on conflict (profile_id, dedupe_key) do nothing;

  return v_msg;
end $$;
