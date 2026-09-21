# Man Up

Discipleship app for the Man Up Men's Ministry at Love First Christian Center (LFCC), led by
Min. James Averitte. Moves men along a ladder: attend gatherings -> join a group -> serve ->
take courses -> lead others. Church Center owns registrations, signups, payments, and
Saturday check-in. This app owns discipleship: what happens between Saturdays. Deep-link to
Church Center, never duplicate it.

Multi-tenant from day one (organizations > ministries). Man Up is tenant one; a women's
ministry or another church onboards as config rows, never schema changes.

## Standalone app (read this first)

Man Up is a standalone product. It has NO integration with any church-wide care or
engagement engine (including "The 99 and the 1"). That integration was designed earlier and
has been removed on purpose. Do not reintroduce any of it:

- No feed views, export endpoints, bearer-token feed routes, or export logs
- No engine alerts inbox, no readiness grants, no cross-project data sharing
- No Inngest job or any other process that sends Man Up data to another system
  If a request seems to need data leaving this app, stop and ask Kevin.

The only external system this app talks to about people is Planning Center (PCO), and only
as a one-way READ (see Non-negotiables 3).

## Authoritative docs (read before designing anything)

- docs/product-map.md - modules, screens, phases
- docs/scoring-plan.md - the internal ministry scoring model (member and leader scores)
- supabase/migrations/ - schema as applied; extend with new migrations, never edit applied ones
  The spec wins over code. If code disagrees with the docs, the code is the bug.

## Stack

- Mobile: Expo (latest stable SDK), Expo Router, TypeScript strict
- Builds and OTA: EAS Build (development, preview, production profiles) and EAS Update
- Admin web: Next.js (App Router) on Vercel, TypeScript strict
- Backend: Supabase project `lfcc-manup` (Postgres, Auth, RLS, Realtime, Storage)
- Scheduled jobs: Inngest functions served from apps/admin (nightly PCO read sync, Sunday night scoring)
- Content: Sanity Studio, one-way webhook sync into Supabase (Sanity authors, Supabase mirrors)
- Video: Mux or Vimeo Pro. Monitoring: Sentry (@sentry/react-native, @sentry/nextjs)
- Push: expo-notifications with Expo push tokens stored in push_tokens

## Repo layout

```
apps/mobile        Expo app (Expo Router, app/ directory)
apps/admin         Next.js admin + API routes (Sanity webhook, Inngest, PCO sync)
packages/shared    generated DB types, enums, supabase client factory, score logic
supabase/          config.toml, migrations/, tests/ (pgTAP), seed.sql
docs/              product-map.md, scoring-plan.md
```

pnpm workspaces. Root .npmrc has `node-linker=hoisted` (required for Expo in a pnpm monorepo).

## Commands

```
pnpm install
pnpm --filter mobile start          # expo start (use a development build, not Expo Go)
pnpm --filter admin dev             # next dev
pnpm exec supabase migration new <name>   # new migration file; never edit an applied one
pnpm test:db                        # pgTAP tests against lfcc-manup; pending migrations applied
                                    # inside the test transaction, everything rolled back
pnpm gen:types                      # regenerate packages/shared/src/database.types.ts from lfcc-manup,
                                    # pending migrations included (rolled back); no Docker or login
pnpm exec supabase db push          # apply migrations to lfcc-manup (Kevin runs this)
pnpm db:seed                        # fictional dev data (re-runnable); password manup-dev-password
pnpm db:unseed                      # remove all dev data; REQUIRED before launch
eas build --profile development --platform ios
eas update --branch preview
```

No Docker and no local Supabase stack. There is one database, lfcc-manup, and
scripts/test-db.mjs tests against it without committing anything: per test file it opens a
transaction, applies unpushed migrations, runs the file, and rolls back. Test files must be
self-contained (create their own orgs, ministries, and auth users inside the transaction).

After every migration: `pnpm test:db` passes with the migration pending, `pnpm gen:types`, then
typecheck both apps. Kevin reviews and runs `supabase db push` (or pastes it into the SQL editor
and runs `supabase migration repair --status applied <version>`). A migration is not done until
all of these pass. Until the history is repaired, prefix commands with APPLIED_MIGRATIONS=0001,...

Dev seed (supabase/seed/): lfcc-manup holds fictional dev data until launch. Seed rows are
marked by uuids starting 5eed and PCO/Sanity ids starting 'seed-'; dev_unseed.sql deletes by
those markers only. Keep new seed rows on the same markers and extend dev_unseed.sql when a
migration adds a table.

## Environment

- Mobile (public, safe to ship): EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_SENTRY_DSN
- Admin (server only): SUPABASE_SERVICE_ROLE_KEY, PCO_APP_ID, PCO_SECRET,
  SANITY_WEBHOOK_SECRET, INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY, SENTRY_AUTH_TOKEN
- The service role key never appears in apps/mobile or in any NEXT*PUBLIC* variable.
- Mobile Supabase client persists the session with AsyncStorage per the Supabase Expo guide.

## Conventions

- Every domain table carries ministry_id. Every RLS policy filters on it and resolves the
  caller's role through fn_ministry_role / fn_is_leader. Never inline role logic in a policy.
- Roles (member | co_leader | leader | admin) live on ministry_members, never on profiles.
- Postgres enums are the source of truth for statuses. Use the generated types in
  packages/shared; do not invent strings.
- Storage paths are namespaced {ministry_id}/... with policies matching the RLS helpers.
- Push notifications resolve recipients through ministry membership, never "all users."
- Scoring jobs iterate per ministry against that ministry's own score_config rows.
  Never hardcode a weight in TypeScript.
- Per-tenant behavior comes from ministry_config (e.g. attendance_source, pco_group_id),
  never from if-statements on a ministry name or id.
- Plain language in UI copy: "My Group" not "Brotherhood", "My Progress" not "My Pathway".
- Plain ASCII in docs and copy. No em dashes.

## Non-negotiables (stop and say so if a request conflicts)

1. STANDALONE: no Man Up data leaves this Supabase project. No export paths of any kind.
2. PRIVACY: prayer requests and interactions, group chat, lesson reflections, and contact
   log notes never appear in any dashboard, score, report, or aggregate. Scores use counts
   of activity (e.g. "posted in group this week"), never content.
3. PCO IS READ-ONLY: Man Up reads the configured Man Up PCO group (roster and Saturday
   gathering attendance) one-way, into pco_roster and pco_gathering_attendance. It never
   writes to Planning Center. Only GET requests to PCO exist in this codebase.
4. IDENTITY: profiles.pco_person_id is set only by an admin confirming a match in the PCO
   Match queue. No member self-entry, no auto-write. Unmatched men use the full app; their
   Saturday attendance just does not count toward their internal score until matched.
5. SCORES: members never see a numeric score. Leaders see tiers and velocity flags.
6. TENANCY: no query, notification, storage path, or job crosses ministry_id lines.
   RLS is the wall; the service role is used only in server-side jobs and API routes.
7. CHURCH CENTER OWNS TRANSACTIONS: if a feature starts reimplementing registration,
   signup, payment, or Saturday check-in for LFCC, stop. (gathering_checkins exists only
   for future non-PCO tenants, behind ministry_config attendance_source = 'in_app'.)

## Do not touch without Kevin's explicit sign-off in the conversation

- Applied migration files (changes always go in a new migration)
- RLS policies and the fn_ministry_role / fn_is_leader helpers
- Anything that adds a network call to a system other than Supabase, PCO (GET), Sanity,
  Mux/Vimeo, Sentry, Expo push, or Inngest

## Build order (Phase 1, one slice per session)

1. Scaffold monorepo, Expo + Next.js + shared package, supabase init. No features.
2. Apply 0001_schema.sql. Write the full RLS policy set and pgTAP tests (below).
3. Auth + open signup (email/password; joins an open ministry as member), optional invite codes
   that grant leader roles, session persistence.
4. My Group: groups, members, meetings, leader-marked attendance with the
   attendance_marked_at gate. Admin: create groups, assign men, promote co-leaders.
5. Gatherings listing with Church Center deep link. Nightly one-way PCO sync. PCO Match queue.
6. Pray, group chat (Realtime), Courses (Sanity webhook sync, lessons, private reflections).
7. Serve (listings with Church Center links, serve logs) and contact logs for leaders.
8. Sunday night scoring job per docs/scoring-plan.md; leader dashboard (mobile) and admin web.
9. Push notifications, Sentry, EAS production profile, store submission.

## Testing

- Every slice that touches the database ships pgTAP tests proving:
  (a) a member of ministry A cannot read any ministry B row on any table,
  (b) group_messages are visible only to current members of that group,
  (c) contact_logs and other men's lesson reflections are invisible to members,
  (d) members cannot read member_scores or leader_scores.
- Commit at every green slice. Small commits keep an agentic build reviewable.
- Kevin reviews every RLS policy before it merges. List policy changes at the top of your
  summary for any slice that includes them.
