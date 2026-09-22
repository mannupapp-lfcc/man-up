-- ============================================================
-- Man Up - Delete account (0015_delete_account.sql).
-- Kevin reviews every function here before push.
--
-- App Store and Google Play require in-app account deletion. delete_my_account()
-- deletes the signed-in man's auth user; everything else follows from the foreign
-- keys, which this migration sets up:
--   * rows that are HIS (messages, prayer requests, "I prayed", check-ins, scores,
--     attendance, contact logs about him, memberships, tokens, blocks, reports he
--     filed) are deleted with him (on delete cascade);
--   * columns that only record who DID something to someone else's row (marked
--     attendance, set a season flag, logged a contact, reviewed a report, created an
--     invite, tuned scoring, confirmed a PCO match, claimed a group serve) become
--     null (on delete set null), so the other men's history survives.
-- "I prayed" taps by other men on his prayer requests go with the request.
-- ============================================================

-- ---------- His rows: deleted with him ----------
do $$
declare
  r record;
begin
  for r in select * from (values
    ('contact_logs', 'profile_id'), ('content_reports', 'reporter_id'), ('gathering_checkins', 'profile_id'),
    ('group_members', 'profile_id'), ('group_messages', 'profile_id'), ('leader_scores', 'profile_id'),
    ('lesson_progress', 'profile_id'), ('meeting_attendance', 'profile_id'), ('member_scores', 'profile_id'),
    ('ministry_members', 'profile_id'), ('ministry_message_alerts', 'profile_id'), ('ministry_messages', 'profile_id'),
    ('pco_match_log', 'profile_id'), ('prayer_interactions', 'profile_id'), ('prayer_requests', 'profile_id'),
    ('push_tokens', 'profile_id'), ('season_flags', 'profile_id'), ('serve_claim_optins', 'profile_id'),
    ('serve_logs', 'profile_id'), ('user_blocks', 'blocker_id'), ('user_blocks', 'blocked_id')
  ) v(tbl, col) loop
    execute format('alter table %I drop constraint %I', r.tbl, r.tbl || '_' || r.col || '_fkey');
    execute format('alter table %I add constraint %I foreign key (%I) references profiles(id) on delete cascade',
                   r.tbl, r.tbl || '_' || r.col || '_fkey', r.col);
  end loop;

  -- ---------- Who did it: kept, but blank once he is gone ----------
  for r in select * from (values
    ('contact_logs', 'leader_id'), ('content_reports', 'reviewed_by'), ('invite_codes', 'created_by'),
    ('meeting_attendance', 'marked_by'), ('pco_match_log', 'performed_by'), ('score_config_changes', 'changed_by'),
    ('season_flags', 'set_by'), ('serve_claims', 'claimed_by'), ('serve_logs', 'logged_by')
  ) v(tbl, col) loop
    execute format('alter table %I alter column %I drop not null', r.tbl, r.col);
    execute format('alter table %I drop constraint %I', r.tbl, r.tbl || '_' || r.col || '_fkey');
    execute format('alter table %I add constraint %I foreign key (%I) references profiles(id) on delete set null',
                   r.tbl, r.tbl || '_' || r.col || '_fkey', r.col);
  end loop;
end $$;

alter table prayer_interactions drop constraint prayer_interactions_prayer_request_id_fkey;
alter table prayer_interactions add constraint prayer_interactions_prayer_request_id_fkey
  foreign key (prayer_request_id) references prayer_requests(id) on delete cascade;

-- ---------- Delete ----------
-- Deletes the caller's sign-in and, through the foreign keys above, his profile and
-- everything that is his. Cannot be undone.
create or replace function delete_my_account()
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke execute on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;
