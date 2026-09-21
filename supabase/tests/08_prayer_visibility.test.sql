-- Prayer visibility: the author chooses his group or the whole ministry.
-- Group requests behave exactly as in 02_group_privacy.
begin;
select no_plan();

-- 'other' (group 2) shares ministry-wide, anonymously; 'unplaced' shares ministry-wide.
insert into prayer_requests (ministry_id, group_id, profile_id, body, is_anonymous, visibility) values
  (tests.m('a'), tests.g('a', 2), tests.u('a', 'other'), 'ministry-wide from group 2', true, 'ministry'),
  (tests.m('a'), null, tests.u('a', 'unplaced'), 'ministry-wide from an unplaced man', false, 'ministry');
insert into prayer_requests (ministry_id, group_id, profile_id, body, visibility)
  values (tests.m('b'), null, tests.u('b', 'member'), 'ministry B wide', 'ministry');

create function tests.count_body(pattern text) returns int language sql as $$
  select count(*)::int from prayer_requests where body like pattern
$$;
grant execute on function tests.count_body(text) to authenticated;

-- ---------- Reading ----------
select tests.login('a', 'member');
select is(tests.count_body('ministry-wide%'), 2, 'a man in group 1 sees both ministry-wide requests');
select is(tests.count_body('group 2 prayer%'), 0, 'he still cannot see group 2''s group-only request');
select is(tests.count_body('ministry B wide'), 0, 'he never sees another ministry''s ministry-wide request');
select throws_ok('select profile_id from prayer_requests', '42501', null,
                 'the author column stays unreadable, so anonymous ministry-wide posts stay anonymous');
reset role;

select tests.login('a', 'unplaced');
select is(tests.count_body('ministry-wide%'), 2, 'a man with no group sees ministry-wide requests');
select is(tests.count_body('member prayer%'), 0, 'but no group-only requests');
reset role;

select tests.login('a', 'admin');
select is(tests.count_body('ministry-wide%'), 2, 'admins see ministry-wide requests (the author chose that)');
select is(tests.count_body('member prayer%') + tests.count_body('group 2 prayer%'), 0,
          'admins still have no browse access to group-only requests');
reset role;

select tests.login('a', 'former');
select is(tests.count_body('member prayer%'), 0, 'a man who left his group loses its group-only requests');
select is(tests.count_body('ministry-wide%'), 2, 'but still sees ministry-wide ones while in the ministry');
reset role;

-- ---------- Posting ----------
select tests.login('a', 'unplaced');
select lives_ok(
  format($$insert into prayer_requests (ministry_id, profile_id, body, visibility)
           values (%L, %L, 'x', 'ministry')$$, tests.m('a'), tests.u('a', 'unplaced')),
  'a man with no group can share ministry-wide');
select throws_ok(
  format($$insert into prayer_requests (ministry_id, profile_id, body, visibility)
           values (%L, %L, 'x', 'group')$$, tests.m('a'), tests.u('a', 'unplaced')),
  '23514', null, 'a group-only request must name a group');
reset role;

select tests.login('a', 'member');
select throws_ok(
  format($$insert into prayer_requests (ministry_id, group_id, profile_id, body, visibility)
           values (%L, %L, %L, 'x', 'ministry')$$, tests.m('a'), tests.g('a', 2), tests.u('a', 'member')),
  '42501', null, 'a ministry-wide request cannot claim a group he is not in');
select throws_ok(
  format($$insert into prayer_requests (ministry_id, profile_id, body, visibility)
           values (%L, %L, 'x', 'ministry')$$, tests.m('b'), tests.u('a', 'member')),
  '42501', null, 'he cannot post into another ministry');
select lives_ok(
  format($$update prayer_requests set visibility = 'ministry' where body = 'member prayer a'$$),
  'the author widens his group request to the ministry');
reset role;
select is((select visibility::text from prayer_requests where body = 'member prayer a'), 'ministry',
          'the change was saved');

select tests.login('a', 'other');
select is(tests.count_body('member prayer a'), 1, 'group 2 now sees the widened request');
select lives_ok(
  format($$insert into prayer_interactions (ministry_id, prayer_request_id, profile_id, kind)
           select ministry_id, id, %L, 'prayed' from prayer_requests where body = 'member prayer a'$$,
         tests.u('a', 'other')),
  'a man from another group can pray for a ministry-wide request');
select is(tests.n($q$select 1 from prayer_interactions i join prayer_requests r on r.id = i.prayer_request_id
                    where r.body = 'member prayer a'$q$), 2,
          'and sees its interactions');
select lives_ok(
  format($$update prayer_requests set visibility = 'group' where body = 'member prayer a'$$),
  'he cannot narrow someone else''s request (matches no rows)');
reset role;
select is((select visibility::text from prayer_requests where body = 'member prayer a'), 'ministry',
          'another man''s update changed nothing');

select tests.login('a', 'member');
select lives_ok(
  format($$update prayer_requests set visibility = 'group' where body = 'member prayer a'$$),
  'the author narrows it back to his group');
reset role;
select tests.login('a', 'other');
select is(tests.count_body('member prayer a'), 0, 'group 2 no longer sees it');
select is(tests.n($q$select 1 from prayer_interactions i where i.profile_id = auth.uid()$q$), 0,
          'nor its interactions, including his own "prayed"');
reset role;

select * from finish();
rollback;
