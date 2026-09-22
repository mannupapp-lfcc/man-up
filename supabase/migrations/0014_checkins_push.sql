-- ============================================================
-- Man Up - Weekly check-in and push notifications (0014_checkins_push.sql).
-- Kevin reviews every policy and function here before push.
--
--   weekly_checkins          1 to 5 plus an optional note, once per week. Visible to
--                            current members of his group only (leaders see them as
--                            group members). No admin access: the privacy wall holds.
--                            Written through submit_checkin. Scoring counts that he
--                            checked in, never the value or the note.
--   push_outbox              one row per (man, notification). Filled by triggers
--                            (group chat, ministry chat alerts) and by the scheduled
--                            Inngest jobs; drained by the push sender with the
--                            service role. No client access. Chat rows carry no text:
--                            the sender reads the message at send time, so a deleted
--                            message is never pushed.
--   notification_settings    per man, per ministry: which optional pushes he gets.
--                            A missing row means everything on.
--   register_push_token      saves this phone's Expo push token for him, and takes it
--                            away from anyone else who signed in on the same phone.
--   ministry_config          push_schedule for Man Up (hours and days of the
--                            scheduled pushes, in the ministry's time zone).
-- ============================================================

-- ---------- Weekly check-in ----------
create table weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  group_id uuid not null references groups(id),
  profile_id uuid not null references profiles(id) on delete cascade,
  week_of date not null,                -- Monday of the week, in the ministry's time zone
  scale smallint not null check (scale between 1 and 5),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ministry_id, profile_id, week_of)
);
alter table weekly_checkins enable row level security;
create index on weekly_checkins (group_id, week_of desc);

-- Current members of the group he posted it in. A man he has blocked disappears
-- for him, same as group chat.
create policy "weekly_checkins: current group members read" on weekly_checkins
  for select to authenticated
  using (fn_in_group(ministry_id, group_id) and (profile_id = auth.uid() or not fn_has_blocked(profile_id)));
-- No insert or update policy: submit_checkin decides the group and the week.

-- Saves (or changes) this week's check-in for his current group in the ministry.
create or replace function submit_checkin(p_ministry uuid, p_scale int, p_note text default null)
returns weekly_checkins
language plpgsql security definer set search_path = public as $$
declare
  v_group uuid;
  v_row weekly_checkins%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if p_scale is null or p_scale not between 1 and 5 then
    raise exception 'Pick a number from 1 to 5.' using errcode = '22023';
  end if;
  select gm.group_id into v_group from group_members gm
  where gm.ministry_id = p_ministry and gm.profile_id = auth.uid() and gm.left_at is null;
  if v_group is null or not fn_in_group(p_ministry, v_group) then
    raise exception 'Check-ins are shared with your group. Join a group first.' using errcode = '42501';
  end if;

  insert into weekly_checkins (ministry_id, group_id, profile_id, week_of, scale, note)
  values (p_ministry, v_group, auth.uid(),
          date_trunc('week', now() at time zone fn_ministry_timezone(p_ministry))::date,
          p_scale, v_note)
  on conflict (ministry_id, profile_id, week_of) do update
    set scale = excluded.scale, note = excluded.note, group_id = excluded.group_id, updated_at = now()
  returning * into v_row;
  return v_row;
end $$;

-- ---------- Notification settings ----------
create table notification_settings (
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id) on delete cascade,
  group_chat boolean not null default true,
  ministry_posts boolean not null default true,     -- @everyone posts (tags always push)
  meeting_reminders boolean not null default true,
  weekly_questions boolean not null default true,
  checkin_prompts boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (ministry_id, profile_id)
);
alter table notification_settings enable row level security;

create policy "notification_settings: own" on notification_settings
  for all to authenticated
  using (profile_id = auth.uid() and fn_ministry_role(ministry_id) is not null)
  with check (profile_id = auth.uid() and fn_ministry_role(ministry_id) is not null);

-- ---------- Push tokens ----------
-- A phone's token belongs to whoever signed in on it last. Without this, a shared or
-- handed-down phone would keep getting the previous man's group chat.
create or replace function register_push_token(p_ministry uuid, p_token text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if fn_ministry_role(p_ministry) is null then
    raise exception 'Only members of this ministry can register for notifications.' using errcode = '42501';
  end if;
  if coalesce(p_token, '') !~ '^Expo(nent)?PushToken\[.+\]$' then
    raise exception 'Not an Expo push token.' using errcode = '22023';
  end if;
  delete from push_tokens where expo_token = p_token and profile_id <> auth.uid();
  insert into push_tokens (profile_id, ministry_id, expo_token)
  values (auth.uid(), p_ministry, p_token)
  on conflict (profile_id, expo_token) do update set ministry_id = excluded.ministry_id;
end $$;

-- ---------- Outbox ----------
create type push_kind as enum (
  'group_message', 'ministry_mention', 'ministry_post',
  'meeting_reminder', 'attendance_prompt', 'weekly_questions', 'checkin_prompt', 'leader_digest'
);

create table push_outbox (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind push_kind not null,
  ref_id uuid,                          -- the message, meeting, group, or question set
  dedupe_key text not null,             -- one push per man per key, however often a job runs
  title text,                           -- null for chat: built from the message at send time
  body text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  result text,                          -- 'sent', 'no_device', 'muted', 'gone', or an error
  unique (profile_id, dedupe_key)
);
alter table push_outbox enable row level security;
create index on push_outbox (created_at) where sent_at is null;
-- RLS on with no policies: signed-in users read and write nothing here.
revoke all on push_outbox from anon;

-- Group chat: every current member of the group except the author and anyone who
-- blocked him.
create or replace function fn_queue_group_message_push()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into push_outbox (ministry_id, profile_id, kind, ref_id, dedupe_key)
  select new.ministry_id, gm.profile_id, 'group_message', new.id, 'group_message:' || new.id
  from group_members gm
  where gm.ministry_id = new.ministry_id and gm.group_id = new.group_id and gm.left_at is null
    and gm.profile_id <> new.profile_id
    and not exists (select 1 from user_blocks b
                    where b.ministry_id = new.ministry_id and b.blocker_id = gm.profile_id
                      and b.blocked_id = new.profile_id)
  on conflict (profile_id, dedupe_key) do nothing;
  return new;
end $$;

create trigger group_messages_queue_push after insert on group_messages
  for each row execute function fn_queue_group_message_push();

-- Ministry chat: post_ministry_message already decided who is alerted (tags, and
-- everyone on an @everyone); copy each alert into the outbox.
create or replace function fn_queue_ministry_alert_push()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into push_outbox (ministry_id, profile_id, kind, ref_id, dedupe_key)
  values (new.ministry_id, new.profile_id,
          case new.kind when 'mention' then 'ministry_mention' else 'ministry_post' end::push_kind,
          new.message_id, 'ministry_message:' || new.message_id)
  on conflict (profile_id, dedupe_key) do nothing;
  return new;
end $$;

create trigger ministry_message_alerts_queue_push after insert on ministry_message_alerts
  for each row execute function fn_queue_ministry_alert_push();

-- ---------- Schedule (Man Up) ----------
-- Days are ISO weekdays (1 = Monday). Hours are local to the ministry's time zone.
insert into ministry_config (ministry_id, key, value) values
  ('00000000-0000-0000-0000-000000000002', 'push_schedule', '{
    "meeting_reminder_hours": 3,
    "attendance_prompt_hours": 2,
    "checkin_day": 4, "checkin_hour": 12,
    "digest_day": 1, "digest_hour": 7,
    "questions_day": 1, "questions_hour": 9
  }')
on conflict (ministry_id, key) do nothing;

revoke execute on function submit_checkin(uuid, int, text)       from public, anon;
revoke execute on function register_push_token(uuid, text)       from public, anon;
revoke execute on function fn_queue_group_message_push()         from public, anon, authenticated;
revoke execute on function fn_queue_ministry_alert_push()        from public, anon, authenticated;
revoke all on weekly_checkins, notification_settings from anon;
