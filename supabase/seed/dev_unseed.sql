-- ============================================================
-- Remove all DEV seed data (supabase/seed/dev_seed.sql).
-- Run before launch: pnpm db:unseed
--
-- Seed rows are identified only by markers, never by name:
--   uuids starting 5eed         (seed users, groups, gatherings, courses, ...)
--   PCO / Sanity ids 'seed-...' (pco_roster, pco_gathering_attendance, sanity_id)
-- Real rows that point at seed rows (e.g. a real man who joined a seed group) are
-- deleted too, since the parent is going away. Children are deleted before parents.
-- ============================================================

drop table if exists _seed_profiles, _seed_groups, _seed_meetings;

create temp table _seed_profiles on commit drop as
  select id from profiles where id::text like '5eed%';
create temp table _seed_groups on commit drop as
  select id from groups where id::text like '5eed%';
create temp table _seed_meetings on commit drop as
  select id from meetings where group_id in (select id from _seed_groups)
     or id::text like '5eed%';

-- Newer tables (0007, 0009) that point at seed people, groups, or opportunities.
-- Guarded so unseed still runs before those migrations are applied.
do $$
begin
  if to_regclass('public.serve_claims') is not null then
    delete from serve_claim_optins
     where profile_id in (select id from _seed_profiles)
        or claim_id in (select id from serve_claims
                        where group_id in (select id from _seed_groups)
                           or opportunity_id::text like '5eed%'
                           or claimed_by in (select id from _seed_profiles));
    delete from serve_claims
     where group_id in (select id from _seed_groups)
        or opportunity_id::text like '5eed%'
        or claimed_by in (select id from _seed_profiles);
  end if;
  if to_regclass('public.user_blocks') is not null then
    delete from user_blocks
     where blocker_id in (select id from _seed_profiles) or blocked_id in (select id from _seed_profiles);
    delete from content_reports
     where reporter_id in (select id from _seed_profiles) or reviewed_by in (select id from _seed_profiles);
  end if;
end $$;

delete from meeting_attendance
 where meeting_id in (select id from _seed_meetings)
    or profile_id in (select id from _seed_profiles)
    or marked_by  in (select id from _seed_profiles);
delete from meetings where id in (select id from _seed_meetings);

-- Prayer requests reference both a seed author and a seed group.
delete from prayer_interactions
 where profile_id in (select id from _seed_profiles)
    or prayer_request_id in (select id from prayer_requests
                             where profile_id in (select id from _seed_profiles)
                                or group_id in (select id from _seed_groups));
delete from prayer_requests
 where profile_id in (select id from _seed_profiles) or group_id in (select id from _seed_groups);

delete from group_messages
 where group_id in (select id from _seed_groups) or profile_id in (select id from _seed_profiles);
delete from group_members
 where group_id in (select id from _seed_groups) or profile_id in (select id from _seed_profiles);
delete from groups where id in (select id from _seed_groups);

delete from lesson_progress
 where profile_id in (select id from _seed_profiles)
    or lesson_id in (select id from lessons where sanity_id like 'seed-%');
delete from lessons where sanity_id like 'seed-%';
delete from gathering_content where sanity_id like 'seed-%';
delete from weekly_questions where sanity_id like 'seed-%';
delete from courses where sanity_id like 'seed-%';

delete from serve_logs
 where profile_id in (select id from _seed_profiles)
    or logged_by  in (select id from _seed_profiles)
    or opportunity_id::text like '5eed%';
delete from serve_opportunities where id::text like '5eed%';

delete from contact_logs
 where profile_id in (select id from _seed_profiles) or leader_id in (select id from _seed_profiles);

delete from gathering_checkins
 where gathering_id::text like '5eed%' or profile_id in (select id from _seed_profiles);
delete from gatherings where id::text like '5eed%';

delete from pco_gathering_attendance where pco_person_id like 'seed-%' or pco_event_id like 'seed-%';
delete from pco_roster where pco_person_id like 'seed-%';
delete from pco_sync_log where id::text like '5eed%';
delete from pco_match_log
 where profile_id in (select id from _seed_profiles)
    or performed_by in (select id from _seed_profiles)
    or pco_person_id like 'seed-%';
-- A real profile an admin matched to a seed PCO person loses that match.
update profiles set pco_person_id = null where pco_person_id like 'seed-%';

delete from invite_codes
 where id::text like '5eed%' or created_by in (select id from _seed_profiles);

delete from member_scores where profile_id in (select id from _seed_profiles);
delete from leader_scores where profile_id in (select id from _seed_profiles);
delete from push_tokens   where profile_id in (select id from _seed_profiles);
delete from ministry_members where profile_id in (select id from _seed_profiles);

delete from profiles where id in (select id from _seed_profiles);
delete from auth.identities where user_id::text like '5eed%';
delete from auth.users where id::text like '5eed%';
