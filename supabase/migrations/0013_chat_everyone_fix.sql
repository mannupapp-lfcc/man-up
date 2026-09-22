-- ============================================================
-- Man Up - @everyone fix (0013_chat_everyone_fix.sql).
-- Kevin reviews this function before push.
--
-- The database has an earlier draft of 0012 in which ANY leader post alerted the
-- whole ministry. The 0012 file was later changed so that only an explicit
-- @everyone (from a leader, co-leader, or admin) fans out. Applied migrations are
-- never edited, so this recreates post_ministry_message exactly as the 0012 file
-- has it. Grants are unchanged (create or replace keeps them).
-- ============================================================

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

  return v_msg;
end $$;
