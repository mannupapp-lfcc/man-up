-- ============================================================
-- Man Up - Message reactions (0021_message_reactions.sql).
-- Kevin reviews every policy and function here before push.
--
-- A man can react to a message in his group chat or the ministry chat with one of a
-- small fixed set (heart, thumbs up, praying hands, raised hands, laughing). He can
-- add several different ones to the same message and take any of his back.
--
--   group_message_reactions     read by whoever can read the group chat (current group
--                               members; overseers read, 0020); only current group
--                               members react. Men he blocked are hidden.
--   ministry_message_reactions  read by every current ministry member; any current
--                               member reacts. Men he blocked are hidden.
--
-- ministry_id and group_id are copied from the message by a trigger, so a client
-- cannot file a reaction under another group or ministry. A reaction goes when its
-- message goes (deleted by him, removed by a report) and when its author deletes his
-- account. Reactions never reach scoring, a dashboard, or a push: they are part of the
-- conversation, which stays private (Non-negotiable 2).
-- ============================================================

create type message_reaction as enum ('heart', 'thumbs_up', 'pray', 'amen', 'laugh');

-- ---------- Group chat ----------
create table group_message_reactions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  group_id uuid not null references groups(id),
  message_id uuid not null references group_messages(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  reaction message_reaction not null,
  created_at timestamptz not null default now(),
  unique (message_id, profile_id, reaction)
);
alter table group_message_reactions enable row level security;
create index on group_message_reactions (group_id, message_id);
create index on group_message_reactions (profile_id);

-- ---------- Ministry chat ----------
create table ministry_message_reactions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  message_id uuid not null references ministry_messages(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  reaction message_reaction not null,
  created_at timestamptz not null default now(),
  unique (message_id, profile_id, reaction)
);
alter table ministry_message_reactions enable row level security;
create index on ministry_message_reactions (ministry_id, message_id);
create index on ministry_message_reactions (profile_id);

-- ---------- Scope comes from the message ----------
-- Definer so it can find the message whatever the caller can read; the insert
-- policy below still requires the caller to see the message himself.
create or replace function fn_group_reaction_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select m.ministry_id, m.group_id into new.ministry_id, new.group_id
  from group_messages m where m.id = new.message_id;
  if new.ministry_id is null then
    raise exception 'That message is gone.' using errcode = '23503';
  end if;
  return new;
end $$;

create trigger group_message_reactions_scope
  before insert on group_message_reactions
  for each row execute function fn_group_reaction_scope();

create or replace function fn_ministry_reaction_scope()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select m.ministry_id into new.ministry_id
  from ministry_messages m where m.id = new.message_id;
  if new.ministry_id is null then
    raise exception 'That message is gone.' using errcode = '23503';
  end if;
  return new;
end $$;

create trigger ministry_message_reactions_scope
  before insert on ministry_message_reactions
  for each row execute function fn_ministry_reaction_scope();

-- ---------- Policies: group chat ----------
-- Same readers as group_messages (members of the group, and overseers), minus men
-- he has blocked.
create policy "group_message_reactions: group members and overseers read" on group_message_reactions
  for select to authenticated
  using ((fn_in_group(ministry_id, group_id) or fn_oversees(ministry_id))
         and (profile_id = auth.uid() or not fn_has_blocked(profile_id)));
-- Only a current member of the group, as himself, on a message he can see (so not
-- on a message from a man he blocked). Overseers read but never react.
create policy "group_message_reactions: group members react" on group_message_reactions
  for insert to authenticated
  with check (profile_id = auth.uid()
              and fn_in_group(ministry_id, group_id)
              and exists (select 1 from group_messages m where m.id = group_message_reactions.message_id));
create policy "group_message_reactions: remove own" on group_message_reactions
  for delete to authenticated
  using (profile_id = auth.uid());

-- ---------- Policies: ministry chat ----------
create policy "ministry_message_reactions: current members read" on ministry_message_reactions
  for select to authenticated
  using (fn_ministry_role(ministry_id) is not null
         and (profile_id = auth.uid() or not fn_has_blocked(profile_id)));
create policy "ministry_message_reactions: current members react" on ministry_message_reactions
  for insert to authenticated
  with check (profile_id = auth.uid()
              and fn_ministry_role(ministry_id) is not null
              and exists (select 1 from ministry_messages m where m.id = ministry_message_reactions.message_id));
create policy "ministry_message_reactions: remove own" on ministry_message_reactions
  for delete to authenticated
  using (profile_id = auth.uid());
-- No update policy on either table: change a reaction by removing it and adding another.

-- ---------- Realtime (RLS applies to subscribers) ----------
alter publication supabase_realtime add table group_message_reactions;
alter publication supabase_realtime add table ministry_message_reactions;

-- ---------- Grants ----------
revoke all on group_message_reactions from anon;
revoke all on ministry_message_reactions from anon;
revoke update on group_message_reactions from authenticated;
revoke update on ministry_message_reactions from authenticated;
revoke execute on function fn_group_reaction_scope()    from public, anon, authenticated;
revoke execute on function fn_ministry_reaction_scope() from public, anon, authenticated;
