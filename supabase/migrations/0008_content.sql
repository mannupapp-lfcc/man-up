-- ============================================================
-- Man Up - Sanity content mirror (0008_content.sql). Slice 6b.
--
-- Sanity authors; the admin app's webhook route (service role) mirrors published
-- documents here by sanity_id. The apps read Supabase only. Unpublished or deleted
-- documents become is_published = false, never hard deletes, so lesson progress
-- keeps pointing at real rows.
-- ============================================================

-- ---------- Courses and lessons ----------
alter table courses add column description text;

alter table lessons add column video_url text;
alter table lessons add column scripture_ref text;
alter table lessons add column scripture_text text;
alter table lessons add column body text;
alter table lessons add column reflection_questions jsonb not null default '[]';
alter table lessons add column is_published boolean not null default true;

drop policy "lessons: members read lessons of published courses" on lessons;
create policy "lessons: members read published lessons of published courses" on lessons
  for select to authenticated
  using (is_published
         and fn_ministry_role(ministry_id) is not null
         and exists (select 1 from courses c
                     where c.id = lessons.course_id and c.ministry_id = lessons.ministry_id
                       and c.is_published));

-- ---------- Gathering content (topic, teacher, pre-work, recap) ----------
-- Attached to a gathering by its local date (PCO events carry no Sanity id).
create table gathering_content (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  sanity_id text not null unique,
  gathering_date date not null,
  topic text,
  teacher text,
  prework_questions jsonb not null default '[]',
  recap text,
  takehome_questions jsonb not null default '[]',
  is_published boolean not null default true,
  synced_at timestamptz not null default now()
);
alter table gathering_content enable row level security;
create index on gathering_content (ministry_id, gathering_date);

create policy "gathering_content: members read published" on gathering_content
  for select to authenticated
  using (is_published and fn_ministry_role(ministry_id) is not null);

-- ---------- Weekly group discussion questions ----------
create table weekly_questions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  sanity_id text not null unique,
  week_of date not null,               -- Monday of the week they are for
  title text,
  questions jsonb not null default '[]',
  is_published boolean not null default true,
  synced_at timestamptz not null default now()
);
alter table weekly_questions enable row level security;
create index on weekly_questions (ministry_id, week_of);

create policy "weekly_questions: members read published" on weekly_questions
  for select to authenticated
  using (is_published and fn_ministry_role(ministry_id) is not null);

revoke all on gathering_content, weekly_questions from anon;
