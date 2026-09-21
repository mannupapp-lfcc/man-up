-- ============================================================
-- Man Up - Signup (0003_signup.sql). Build order slice 3.
--
-- Anyone can create an account. A ministry that allows it (ministry_config
-- open_signup = true) takes new men as members right away. Group content stays
-- locked until an admin places him in a group (0002 policies).
-- Invite codes are optional and exist to grant leader roles (co_leader, leader,
-- admin), including to a man who already joined as a member.
--
--   list_open_ministries()               signed out or in: what can I join?
--   join_ministry(ministry, name, phone) signed in: join as a member
--   check_invite(code)                   signed out or in: is this code good?
--   redeem_invite(code, name, phone)     signed in: join, or be promoted, by code
-- All are SECURITY DEFINER: clients have no direct write access to profiles
-- (insert), ministry_members, or invite_codes.
-- ============================================================

-- Man Up takes open signups. Per-tenant behavior lives in config, not code.
insert into ministry_config (ministry_id, key, value) values
  ('00000000-0000-0000-0000-000000000002', 'open_signup', 'true');

-- Codes are matched case-insensitively, so they must be unique that way too.
create unique index invite_codes_code_upper_key on invite_codes (upper(code));

create or replace function fn_open_signup(p_ministry uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ministries mi
    join ministry_config c on c.ministry_id = mi.id
    where mi.id = p_ministry and mi.status = 'active'
      and c.key = 'open_signup' and c.value = 'true'::jsonb)
$$;

create or replace function list_open_ministries()
returns table (ministry_id uuid, ministry_name text, organization_name text)
language sql stable security definer set search_path = public as $$
  select mi.id, mi.name, o.name
  from ministries mi
  join organizations o on o.id = mi.organization_id
  where fn_open_signup(mi.id)
  order by o.name, mi.name
$$;

-- Internal: create the caller's profile (first time only) and set his membership
-- in p_ministry to at least p_role. Never lowers a role. Returns true when it
-- created or raised a membership (so a code use should be counted).
--   * Profile in another organization: refused (tenancy).
--   * Left the ministry before: refused; an admin restores him, so a public
--     signup or a general code cannot undo an admin removal.
create or replace function fn_ensure_membership(
  p_ministry uuid, p_role ministry_role, p_full_name text, p_phone text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_uid    uuid := auth.uid();
  v_org    uuid;
  v_member ministry_members%rowtype;
  v_email  text;
begin
  if v_uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  select organization_id into v_org from ministries where id = p_ministry;

  if exists (select 1 from profiles where id = v_uid and organization_id <> v_org) then
    raise exception 'This account belongs to a different church.' using errcode = 'P0001';
  end if;

  if not exists (select 1 from profiles where id = v_uid) then
    if coalesce(trim(p_full_name), '') = '' then
      raise exception 'Please enter your name.' using errcode = '22023';
    end if;
    select email into v_email from auth.users where id = v_uid;
    insert into profiles (id, organization_id, full_name, phone, email)
    values (v_uid, v_org, trim(p_full_name), nullif(trim(coalesce(p_phone, '')), ''), v_email);
  end if;

  select * into v_member from ministry_members
  where ministry_id = p_ministry and profile_id = v_uid
  for update;

  if not found then
    insert into ministry_members (ministry_id, profile_id, role)
    values (p_ministry, v_uid, p_role);
    return true;
  end if;

  if v_member.left_at is not null then
    raise exception 'Your membership was ended. Ask a ministry admin to restore it.' using errcode = 'P0001';
  end if;

  -- Enum order is member < co_leader < leader < admin.
  if p_role > v_member.role then
    update ministry_members set role = p_role, role_since = current_date where id = v_member.id;
    return true;
  end if;

  return false;
end $$;

create or replace function join_ministry(p_ministry uuid, p_full_name text, p_phone text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not fn_open_signup(p_ministry) then
    raise exception 'This ministry is not taking signups in the app. Ask for an invite code.' using errcode = 'P0001';
  end if;
  perform fn_ensure_membership(p_ministry, 'member', p_full_name, p_phone);
  return p_ministry;
end $$;

-- A code is usable when it is not revoked, not expired, not used up, and its
-- ministry is active. Returns no row otherwise (no reason given, by design).
create or replace function check_invite(p_code text)
returns table (ministry_name text, role ministry_role)
language sql stable security definer set search_path = public as $$
  select mi.name, ic.role_granted
  from invite_codes ic
  join ministries mi on mi.id = ic.ministry_id
  where upper(ic.code) = upper(trim(p_code))
    and ic.revoked_at is null
    and (ic.expires_at is null or ic.expires_at > now())
    and (ic.max_uses is null or ic.uses < ic.max_uses)
    and mi.status = 'active'
$$;

create or replace function redeem_invite(p_code text, p_full_name text default null, p_phone text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_code invite_codes%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;

  -- Lock the code so two men cannot both take its last use.
  select ic.* into v_code
  from invite_codes ic
  join ministries mi on mi.id = ic.ministry_id
  where upper(ic.code) = upper(trim(p_code))
    and ic.revoked_at is null
    and (ic.expires_at is null or ic.expires_at > now())
    and (ic.max_uses is null or ic.uses < ic.max_uses)
    and mi.status = 'active'
  for update of ic;
  if not found then
    raise exception 'That invite code is not valid. Check it with the person who gave it to you.' using errcode = 'P0001';
  end if;

  if fn_ensure_membership(v_code.ministry_id, v_code.role_granted, p_full_name, p_phone) then
    update invite_codes set uses = uses + 1 where id = v_code.id;
  end if;

  return v_code.ministry_id;
end $$;

-- Supabase grants EXECUTE on new functions to anon and authenticated directly, so
-- revoking from public is not enough. fn_ensure_membership must never be callable
-- by a client (it would let a man grant himself any role).
revoke execute on function fn_open_signup(uuid)                               from public, anon, authenticated;
revoke execute on function fn_ensure_membership(uuid, ministry_role, text, text) from public, anon, authenticated;
revoke execute on function list_open_ministries()                             from public, anon, authenticated;
revoke execute on function join_ministry(uuid, text, text)                    from public, anon, authenticated;
revoke execute on function check_invite(text)                                 from public, anon, authenticated;
revoke execute on function redeem_invite(text, text, text)                    from public, anon, authenticated;

grant execute on function list_open_ministries()          to anon, authenticated;
grant execute on function check_invite(text)              to anon, authenticated;
grant execute on function join_ministry(uuid, text, text) to authenticated;
grant execute on function redeem_invite(text, text, text) to authenticated;
