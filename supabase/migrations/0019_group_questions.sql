-- ============================================================
-- 0019: Group leaders write their group's weekly discussion questions in the app.
--
-- Replaces the ministry-wide question sets authored in Sanity (weekly_questions,
-- 0008), which are dropped here. That table only mirrored Sanity, so nothing is lost:
-- the documents are still in the Sanity dataset. Gathering content and courses stay
-- in Sanity.
--
-- Only the group's current leader or co-leader writes (fn_leads_group); only the men
-- currently in the group read (fn_in_group). Not scored (scoring-plan v1.1 dropped
-- "content preparation").
-- ============================================================

drop table weekly_questions;

create table group_weekly_questions (
  id uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references ministries(id),
  group_id uuid not null references groups(id),
  week_of date not null,                 -- Monday of the week they are for
  title text,
  questions jsonb not null,              -- array of strings, 1 to 10
  posted_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, week_of),
  constraint group_weekly_questions_monday check (extract(isodow from week_of) = 1),
  constraint group_weekly_questions_title check (title is null or char_length(title) between 1 and 120),
  constraint group_weekly_questions_list check (
    jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 10)
);
alter table group_weekly_questions enable row level security;
create index on group_weekly_questions (ministry_id, group_id, week_of);

-- Every question is a non-empty string of at most 500 characters. A check constraint
-- cannot hold a subquery, so a trigger enforces it (and stamps updated_at).
create or replace function fn_check_group_questions()
returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from jsonb_array_elements(new.questions) q
             where jsonb_typeof(q) <> 'string' or char_length(trim(q #>> '{}')) not between 1 and 500) then
    raise exception 'each question must be text of 1 to 500 characters' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger group_weekly_questions_check
  before insert or update on group_weekly_questions
  for each row execute function fn_check_group_questions();

-- Read: the men currently in the group.
create policy "group_weekly_questions: current group members read" on group_weekly_questions
  for select to authenticated
  using (fn_in_group(ministry_id, group_id));

-- Write: only a current leader or co-leader of that group, posting as himself.
create policy "group_weekly_questions: group leaders post" on group_weekly_questions
  for insert to authenticated
  with check (fn_leads_group(ministry_id, group_id) and posted_by = auth.uid());
create policy "group_weekly_questions: group leaders edit" on group_weekly_questions
  for update to authenticated
  using (fn_leads_group(ministry_id, group_id))
  with check (fn_leads_group(ministry_id, group_id) and posted_by = auth.uid());
create policy "group_weekly_questions: group leaders remove" on group_weekly_questions
  for delete to authenticated
  using (fn_leads_group(ministry_id, group_id));

revoke all on group_weekly_questions from anon;
