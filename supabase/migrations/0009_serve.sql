-- ============================================================
-- Man Up - Serve (0009_serve.sql). Build order slice 7.
--
-- Serve opportunities mirror the PCO Registrations sign-ups an admin picks (by
-- category or one by one). Church Center owns sign-up (Non-negotiable 7); the app
-- only links out. Group serve projects: a leader claims an opportunity for his
-- group, men opt in, and afterward the leader confirms who served (serve_logs).
-- Contact logs need no schema change: 0002 already limits them to the man's
-- group leaders.
-- Kevin reviews every policy here before push.
-- ============================================================

insert into ministry_config (ministry_id, key, value) values
  ('00000000-0000-0000-0000-000000000002', 'pco_serve_category_ids', '[]'),
  ('00000000-0000-0000-0000-000000000002', 'pco_serve_signup_ids', '[]')
on conflict (ministry_id, key) do nothing;

-- ---------- Opportunities mirror PCO sign-ups ----------
alter table serve_opportunities add column pco_signup_id text;
alter table serve_opportunities add column description text;
alter table serve_opportunities add column when_text text;           -- PCO's own summary, e.g. "October 10, 2026"
alter table serve_opportunities add column registration_open boolean not null default true;
alter table serve_opportunities add column active boolean not null default true;   -- false once no longer picked or archived
alter table serve_opportunities add column synced_at timestamptz;
alter table serve_opportunities add constraint serve_opportunities_pco_signup_key unique (ministry_id, pco_signup_id);

alter table pco_sync_log drop constraint pco_sync_log_resource_check;
alter table pco_sync_log add constraint pco_sync_log_resource_check
  check (resource in ('roster', 'events', 'gathering_attendance', 'signups'));

-- ---------- Group serve projects ----------
create table serve_claims (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  group_id uuid not null references groups(id),
  opportunity_id uuid not null references serve_opportunities(id),
  claimed_by uuid not null references profiles(id),
  confirmed_at timestamptz,                      -- set when the leader confirms who served
  created_at timestamptz not null default now(),
  unique (group_id, opportunity_id)
);
alter table serve_claims enable row level security;

create table serve_claim_optins (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  claim_id uuid not null references serve_claims(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (claim_id, profile_id)
);
alter table serve_claim_optins enable row level security;

create policy "serve_claims: group members read" on serve_claims
  for select to authenticated
  using (fn_in_group(ministry_id, group_id) or fn_is_admin(ministry_id));
create policy "serve_claims: group leaders claim" on serve_claims
  for insert to authenticated
  with check (
    claimed_by = auth.uid() and confirmed_at is null
    and fn_leads_group(ministry_id, group_id)
    and exists (select 1 from serve_opportunities o
                where o.id = serve_claims.opportunity_id and o.ministry_id = serve_claims.ministry_id));
create policy "serve_claims: group leaders unclaim" on serve_claims
  for delete to authenticated
  using (fn_leads_group(ministry_id, group_id) and confirmed_at is null);

-- Opt-ins are visible to the group (so men see who is going) and admins.
create policy "serve_claim_optins: group members read" on serve_claim_optins
  for select to authenticated
  using (exists (select 1 from serve_claims c
                 where c.id = serve_claim_optins.claim_id and c.ministry_id = serve_claim_optins.ministry_id));
create policy "serve_claim_optins: opt in as self" on serve_claim_optins
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (select 1 from serve_claims c
                where c.id = serve_claim_optins.claim_id and c.ministry_id = serve_claim_optins.ministry_id
                  and c.confirmed_at is null and fn_in_group(c.ministry_id, c.group_id)));
create policy "serve_claim_optins: opt out as self" on serve_claim_optins
  for delete to authenticated
  using (profile_id = auth.uid());

-- Confirms who served on a group project, in one step: a serve_logs row per man,
-- logged by the confirming leader. SECURITY INVOKER: the 0002 serve_logs policy
-- (his group's leaders or admins) decides; every man must be in the claiming group.
create or replace function confirm_group_serve(p_claim uuid, p_served uuid[], p_served_on date)
returns int
language plpgsql security invoker set search_path = public as $$
declare
  v serve_claims%rowtype;
  v_count int;
begin
  select * into v from serve_claims where id = p_claim;
  if not found then
    raise exception 'Group project not found.' using errcode = 'P0002';
  end if;
  if not (fn_leads_group(v.ministry_id, v.group_id) or fn_is_admin(v.ministry_id)) then
    raise exception 'Only this group''s leaders can confirm who served.' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(p_served) s(pid)
             where not exists (select 1 from group_members gm
                               where gm.group_id = v.group_id and gm.profile_id = s.pid and gm.left_at is null)) then
    raise exception 'Only men in this group can be confirmed.' using errcode = 'P0001';
  end if;

  insert into serve_logs (ministry_id, opportunity_id, profile_id, served_at, logged_by)
  select v.ministry_id, v.opportunity_id, pid, p_served_on, auth.uid()
  from unnest(p_served) s(pid)
  where not exists (select 1 from serve_logs l
                    where l.opportunity_id = v.opportunity_id and l.profile_id = s.pid and l.served_at = p_served_on);
  get diagnostics v_count = row_count;

  update serve_claims set confirmed_at = now() where id = p_claim and confirmed_at is null;
  return v_count;
end $$;

-- Confirming needs to stamp confirmed_at; only via confirm_group_serve's own update,
-- which runs as the caller, so leaders get an update policy limited to that column.
create policy "serve_claims: group leaders confirm" on serve_claims
  for update to authenticated
  using (fn_leads_group(ministry_id, group_id) or fn_is_admin(ministry_id))
  with check (fn_leads_group(ministry_id, group_id) or fn_is_admin(ministry_id));
revoke update on serve_claims from authenticated;
grant update (confirmed_at) on serve_claims to authenticated;

revoke execute on function confirm_group_serve(uuid, uuid[], date) from public, anon;
revoke all on serve_claims, serve_claim_optins from anon;
