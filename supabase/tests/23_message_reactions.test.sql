-- Message reactions (0021): group chat reactions follow group chat privacy; ministry
-- chat reactions follow ministry chat. Blocks hide a man's reactions; scope comes from
-- the message, never from the client; overseers read but never react.
begin;
select no_plan();

-- Fixture: 'member2' hearted 'group 1 message', 'member' thumbed up 'ministry message'.
create table tests.ids as
  select (select id from group_messages where body = 'group 1 message a') as g1msg,
         (select id from group_messages where body = 'group 2 message a') as g2msg,
         (select id from ministry_messages where body = 'ministry message a') as mmsg,
         (select id from group_messages where body = 'group 1 message b') as bmsg,
         (select id from ministry_messages where body = 'ministry message b') as bmmsg;
grant select on tests.ids to authenticated;

-- ---------- Group chat: reading ----------
select tests.login('a', 'member');
select is(tests.n('select 1 from group_message_reactions'), 1, 'a group member reads reactions in his group');
reset role;
select tests.login('a', 'other');
select is(tests.n('select 1 from group_message_reactions'), 0, 'a man in another group reads none of them');
reset role;
select tests.login('a', 'former');
select is(tests.n('select 1 from group_message_reactions'), 0, 'a man who left the group reads none');
reset role;
select tests.login('a', 'admin');
select is(tests.n('select 1 from group_message_reactions'), 0, 'a plain admin reads no group reactions');
reset role;
select tests.login('b', 'member');
select is(tests.n('select 1 from group_message_reactions'), 1, 'ministry B sees only its own');
select is(tests.n(format('select 1 from group_message_reactions where ministry_id = %L', tests.m('a'))), 0,
          'nothing from ministry A');
reset role;

-- ---------- Group chat: reacting ----------
select tests.login('a', 'member');
select lives_ok(format($$insert into group_message_reactions (message_id, profile_id, reaction)
                         select g1msg, %L, 'pray' from tests.ids$$, tests.u('a', 'member')),
                'a group member reacts to a message in his group');
select is((select group_id from group_message_reactions where reaction = 'pray'), tests.g('a', 1),
          'the group comes from the message');
select throws_ok(format($$insert into group_message_reactions (message_id, profile_id, reaction)
                          select g1msg, %L, 'pray' from tests.ids$$, tests.u('a', 'member')),
                 '23505', null, 'the same reaction twice is refused');
select lives_ok(format($$insert into group_message_reactions (message_id, profile_id, reaction)
                         select g1msg, %L, 'amen' from tests.ids$$, tests.u('a', 'member')),
                'a different reaction on the same message is fine');
select throws_ok(format($$insert into group_message_reactions (message_id, profile_id, reaction)
                          select g1msg, %L, 'laugh' from tests.ids$$, tests.u('a', 'member2')),
                 '42501', null, 'he cannot react as another man');
select throws_ok(format($$insert into group_message_reactions (message_id, profile_id, reaction)
                          select g2msg, %L, 'heart' from tests.ids$$, tests.u('a', 'member')),
                 '42501', null, 'he cannot react in a group he is not in');
select throws_ok(format($$insert into group_message_reactions (ministry_id, group_id, message_id, profile_id, reaction)
                          select %L, %L, g2msg, %L, 'heart' from tests.ids$$,
                        tests.m('a'), tests.g('a', 1), tests.u('a', 'member')),
                 '42501', null, 'passing his own group id does not help (scope comes from the message)');
select throws_ok(format($$insert into group_message_reactions (message_id, profile_id, reaction)
                          select bmsg, %L, 'heart' from tests.ids$$, tests.u('a', 'member')),
                 '42501', null, 'he cannot react in another ministry');
select throws_ok($$update group_message_reactions set reaction = 'laugh' where reaction = 'pray'$$,
                 '42501', null, 'reactions cannot be edited');
select lives_ok($$delete from group_message_reactions where reaction = 'heart'$$, 'deleting another man''s reaction is a no-op');
select is(tests.n($$select 1 from group_message_reactions where reaction = 'heart'$$), 1, 'his heart is still there');
select lives_ok($$delete from group_message_reactions where reaction = 'amen'$$, 'he takes his own back');
select is(tests.n($$select 1 from group_message_reactions where reaction = 'amen'$$), 0, 'and it is gone');
reset role;

-- ---------- Overseers read, never react ----------
update ministry_members set is_overseer = true
where ministry_id = tests.m('a') and profile_id = tests.u('a', 'admin');
select tests.login('a', 'admin');
select is(tests.n('select 1 from group_message_reactions'), 2, 'an overseer reads group reactions');
select throws_ok(format($$insert into group_message_reactions (message_id, profile_id, reaction)
                          select g1msg, %L, 'heart' from tests.ids$$, tests.u('a', 'admin')),
                 '42501', null, 'but cannot react inside a group he is not in');
reset role;

-- ---------- Ministry chat ----------
select tests.login('a', 'unplaced');
select is(tests.n('select 1 from ministry_message_reactions'), 1, 'a man in no group reads ministry chat reactions');
select lives_ok(format($$insert into ministry_message_reactions (message_id, profile_id, reaction)
                         select mmsg, %L, 'heart' from tests.ids$$, tests.u('a', 'unplaced')),
                'and reacts');
select is((select ministry_id from ministry_message_reactions where reaction = 'heart'), tests.m('a'),
          'the ministry comes from the message');
select throws_ok(format($$insert into ministry_message_reactions (message_id, profile_id, reaction)
                          select bmmsg, %L, 'heart' from tests.ids$$,
                        tests.u('a', 'unplaced')),
                 '42501', null, 'he cannot react in another ministry');
reset role;
select tests.login('b', 'member');
select is(tests.n(format('select 1 from ministry_message_reactions where ministry_id = %L', tests.m('a'))), 0,
          'ministry B reads no ministry A reactions');
reset role;

-- ---------- Blocks ----------
insert into user_blocks (ministry_id, blocker_id, blocked_id)
  values (tests.m('a'), tests.u('a', 'leader'), tests.u('a', 'member2')),
         (tests.m('a'), tests.u('a', 'other'), tests.u('a', 'member'));
select tests.login('a', 'leader');
select is(tests.n($$select 1 from group_message_reactions where reaction = 'heart'$$), 0,
          'a blocked man''s reactions disappear for the man who blocked him');
reset role;
select tests.login('a', 'other');
select is(tests.n($$select 1 from ministry_message_reactions where reaction = 'thumbs_up'$$), 0,
          'in ministry chat too');
select tests.login('a', 'leader');
select is(tests.n($$select 1 from ministry_message_reactions where reaction = 'thumbs_up'$$), 1,
          'and no one else loses them');
reset role;
select tests.login('a', 'member');
select throws_ok(format($$insert into group_message_reactions (message_id, profile_id, reaction)
                          select g1msg, %L, 'heart' from tests.ids$$, tests.u('a', 'leader')),
                 '42501', null, 'still only as himself');
reset role;
-- 'leader' blocked 'member2', who wrote nothing here; 'other' blocked 'member', who
-- wrote group 1 message. 'other' is not in group 1, so test the ministry side:
-- a man cannot react to a message he cannot see.
insert into ministry_messages (ministry_id, profile_id, body)
  values (tests.m('a'), tests.u('a', 'member'), 'member says hi');
create table tests.hi as select id from ministry_messages where body = 'member says hi';
grant select on tests.hi to authenticated;
select tests.login('a', 'other');
select throws_ok(format($$insert into ministry_message_reactions (message_id, profile_id, reaction)
                          select id, %L, 'heart' from tests.hi$$,
                        tests.u('a', 'other')),
                 '42501', null, 'he cannot react to a message from a man he blocked');
reset role;

-- ---------- Deleting ----------
delete from group_messages where id = (select g1msg from tests.ids);
select is((select count(*)::int from group_message_reactions where ministry_id = tests.m('a') and group_id = tests.g('a', 1)), 0,
          'a deleted message takes its reactions with it');
delete from auth.users where id = tests.u('a', 'unplaced');
select is((select count(*)::int from ministry_message_reactions where profile_id = tests.u('a', 'unplaced')), 0,
          'a deleted account takes his reactions with him');

-- ---------- Never in scoring or push ----------
select is((select count(*)::int from pg_proc where prosrc ilike '%message_reactions%'
           and proname not in ('fn_group_reaction_scope', 'fn_ministry_reaction_scope')), 0,
          'no other database function reads reactions');

select * from finish();
rollback;
