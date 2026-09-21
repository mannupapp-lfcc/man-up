-- ============================================================
-- Man Up - Phase 1 Schema (0001_schema.sql)
-- Supabase project: lfcc-manup. Standalone: no feeds, views, or
-- tables exist for sharing data with any other system.
-- Multi-tenant: organizations > ministries. Every domain table
-- carries ministry_id. Roles live on ministry_members.
-- RLS is enabled on every table. Tables with no policy yet are
-- locked by default; full policies are written in the RLS slice.
-- ============================================================

-- ---------- Enums ----------
create type ministry_role     as enum ('member', 'co_leader', 'leader', 'admin');
create type attendance_status as enum ('present', 'absent', 'excused');
create type group_status      as enum ('forming', 'active', 'archived');
create type prayer_status     as enum ('open', 'answered', 'archived');
create type contact_method    as enum ('call', 'text', 'in_person', 'other');

-- ---------- Tenancy ----------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table ministries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  ministry_key text not null unique,            -- stable slug, e.g. 'manup'
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

-- Per-tenant behavior. Known keys:
--   attendance_source: "pco" | "in_app"   (LFCC Man Up = "pco")
--   pco_group_id: "<PCO Groups id>"        (the Man Up group in Planning Center)
create table ministry_config (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (ministry_id, key)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  full_name text not null,
  phone text,
  email text,
  photo_url text,
  pco_person_id text unique,                    -- admin-matched only; links PCO gathering attendance
  created_at timestamptz not null default now()
);

create table ministry_members (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id),
  role ministry_role not null default 'member',
  role_since date not null default current_date,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (ministry_id, profile_id)
);

create table invite_codes (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  code text not null unique,
  role_granted ministry_role not null default 'member',
  max_uses int,
  uses int not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- RLS helpers (every policy goes through these) ----------
create or replace function fn_ministry_role(p_ministry uuid)
returns ministry_role
language sql stable security definer set search_path = public as $$
  select role from ministry_members
  where ministry_id = p_ministry and profile_id = auth.uid() and left_at is null
$$;

create or replace function fn_is_leader(p_ministry uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(fn_ministry_role(p_ministry) in ('co_leader', 'leader', 'admin'), false)
$$;

create or replace function fn_is_admin(p_ministry uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(fn_ministry_role(p_ministry) = 'admin', false)
$$;

-- ---------- Small groups (app-native, never mirrored to PCO) ----------
create table groups (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  name text not null,
  status group_status not null default 'forming',
  meeting_day text,
  created_at timestamptz not null default now()
);

create table group_members (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  group_id uuid not null references groups(id),
  profile_id uuid not null references profiles(id),
  is_group_leader boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (group_id, profile_id)
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  group_id uuid not null references groups(id),
  meeting_at timestamptz not null,
  attendance_marked_at timestamptz,             -- null = unmarked; unmarked meetings are not "held"
  created_at timestamptz not null default now()
);

create table meeting_attendance (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  meeting_id uuid not null references meetings(id),
  profile_id uuid not null references profiles(id),
  status attendance_status not null,
  marked_by uuid references profiles(id),
  marked_at timestamptz not null default now(),
  unique (meeting_id, profile_id)
);

-- ---------- Gatherings (Saturday) ----------
-- LFCC: listing + Church Center deep link only. Check-in happens in Church Center.
create table gatherings (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  title text not null,
  gathering_at timestamptz not null,
  church_center_url text,
  pco_event_id text,                            -- links to pco_gathering_attendance
  created_at timestamptz not null default now()
);

-- Dormant for LFCC. Used only when ministry_config attendance_source = 'in_app'.
create table gathering_checkins (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  gathering_id uuid not null references gatherings(id),
  profile_id uuid not null references profiles(id),
  checked_in_at timestamptz not null default now(),
  unique (gathering_id, profile_id)
);

-- ---------- PCO one-way read mirror (written only by the nightly sync) ----------
create table pco_roster (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  pco_person_id text not null,
  full_name text,
  email text,
  phone text,
  synced_at timestamptz not null default now(),
  unique (ministry_id, pco_person_id)
);

create table pco_gathering_attendance (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  pco_person_id text not null,
  pco_event_id text not null,
  event_at timestamptz not null,
  synced_at timestamptz not null default now(),
  unique (ministry_id, pco_person_id, pco_event_id)
);
create index on pco_gathering_attendance (pco_person_id, event_at);

create table pco_sync_log (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  resource text not null check (resource in ('roster', 'gathering_attendance')),
  rows_upserted int not null default 0,
  status text not null check (status in ('ok', 'error')),
  error text,
  ran_at timestamptz not null default now()
);

create table pco_match_log (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id),
  pco_person_id text,                           -- null when an admin clears a match
  action text not null check (action in ('matched', 'cleared')),
  performed_by uuid not null references profiles(id),
  performed_at timestamptz not null default now()
);

-- ---------- Pray (content never leaves the feature) ----------
create table prayer_requests (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id),
  body text not null,
  is_anonymous boolean not null default false,
  status prayer_status not null default 'open',
  created_at timestamptz not null default now()
);

create table prayer_interactions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  prayer_request_id uuid not null references prayer_requests(id),
  profile_id uuid not null references profiles(id),
  kind text not null check (kind in ('prayed', 'comment')),
  body text,
  created_at timestamptz not null default now()
);

-- ---------- Group chat (content never leaves the feature) ----------
create table group_messages (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  group_id uuid not null references groups(id),
  profile_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- Courses (Sanity authors, Supabase mirrors) ----------
create table courses (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  sanity_id text not null unique,
  title text not null,
  is_published boolean not null default false,
  synced_at timestamptz not null default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  course_id uuid not null references courses(id),
  sanity_id text not null unique,
  title text not null,
  sort_order int not null,
  synced_at timestamptz not null default now()
);

create table lesson_progress (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  lesson_id uuid not null references lessons(id),
  profile_id uuid not null references profiles(id),
  completed_at timestamptz,
  reflection text,                              -- private to the man; completion is scorable, content is not
  unique (lesson_id, profile_id)
);

create table sanity_sync_log (
  id uuid primary key default gen_random_uuid(),
  document_type text not null,
  sanity_id text not null,
  action text not null,
  synced_at timestamptz not null default now()
);

-- ---------- Serve ----------
create table serve_opportunities (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  title text not null,
  serve_at timestamptz,
  church_center_url text,                       -- Church Center owns signup
  created_at timestamptz not null default now()
);

create table serve_logs (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  opportunity_id uuid references serve_opportunities(id),
  profile_id uuid not null references profiles(id),
  served_at date not null,
  logged_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ---------- Shepherding contacts ----------
create table contact_logs (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id),     -- the man contacted
  leader_id uuid not null references profiles(id),
  contacted_at timestamptz not null default now(),
  method contact_method,
  note text                                             -- leaders only; never in dashboards
);

-- ---------- Internal scoring (see docs/scoring-plan.md) ----------
create table score_config (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  key text not null,
  value numeric not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (ministry_id, key)
);

create table member_scores (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id),
  as_of date not null,
  total numeric not null,
  tier text not null,
  velocity_alert boolean not null default false,
  components jsonb not null,
  unique (ministry_id, profile_id, as_of)
);

create table leader_scores (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  profile_id uuid not null references profiles(id),
  as_of date not null,
  total numeric not null,
  components jsonb not null,
  unique (ministry_id, profile_id, as_of)
);

-- ---------- Push ----------
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  ministry_id uuid not null references ministries(id),
  expo_token text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, expo_token)
);

-- ============================================================
-- RLS: on for everything. No policy = locked (service role only).
-- ============================================================
alter table organizations            enable row level security;
alter table ministries               enable row level security;
alter table ministry_config          enable row level security;
alter table profiles                 enable row level security;
alter table ministry_members         enable row level security;
alter table invite_codes             enable row level security;
alter table groups                   enable row level security;
alter table group_members            enable row level security;
alter table meetings                 enable row level security;
alter table meeting_attendance       enable row level security;
alter table gatherings               enable row level security;
alter table gathering_checkins       enable row level security;
alter table pco_roster               enable row level security;
alter table pco_gathering_attendance enable row level security;
alter table pco_sync_log             enable row level security;
alter table pco_match_log            enable row level security;
alter table prayer_requests          enable row level security;
alter table prayer_interactions      enable row level security;
alter table group_messages           enable row level security;
alter table courses                  enable row level security;
alter table lessons                  enable row level security;
alter table lesson_progress          enable row level security;
alter table sanity_sync_log          enable row level security;
alter table serve_opportunities      enable row level security;
alter table serve_logs               enable row level security;
alter table contact_logs             enable row level security;
alter table score_config             enable row level security;
alter table member_scores            enable row level security;
alter table leader_scores            enable row level security;
alter table push_tokens              enable row level security;

-- Starter policies (pattern to replicate in the RLS slice; Kevin reviews all)
create policy "own profile read" on profiles for select using (id = auth.uid());
create policy "own profile update" on profiles for update using (id = auth.uid())
  with check (id = auth.uid());

create policy "groups visible to ministry members" on groups for select
  using (fn_ministry_role(ministry_id) is not null);

create policy "chat visible to current group members" on group_messages for select
  using (exists (select 1 from group_members gm
                 where gm.group_id = group_messages.group_id
                   and gm.profile_id = auth.uid() and gm.left_at is null));

create policy "contact logs: ministry leaders only" on contact_logs for select
  using (fn_is_leader(ministry_id));

create policy "own lesson progress" on lesson_progress for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "member scores: leaders only" on member_scores for select
  using (fn_is_leader(ministry_id));

create policy "own push tokens" on push_tokens for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------- Seed: LFCC + Man Up ----------
insert into organizations (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Love First Christian Center');
insert into ministries (id, organization_id, name, ministry_key) values
  ('00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001', 'Man Up', 'manup');
insert into ministry_config (ministry_id, key, value) values
  ('00000000-0000-0000-0000-000000000002', 'attendance_source', '"pco"');
-- Set pco_group_id once you have the Man Up group id from PCO:
-- insert into ministry_config (ministry_id, key, value) values
--   ('00000000-0000-0000-0000-000000000002', 'pco_group_id', '"<id>"');