# Man Up Backlog

Open items that are not part of a build-order slice yet. Newest decisions first within
each section. When an item is done, delete it (git history keeps the record).

## To build

- **Roster change requests (needs Kevin's sign-off: new table and RLS).** Product map says
  leaders request roster changes and admins approve (sections 3 and 5). Nothing exists yet.
  Proposed: a new migration adding roster_change_requests (ministry_id, group_id, profile_id,
  kind add | remove | move (add can name a man in no group), target_group_id, requested_by, status pending | approved | declined
  as a Postgres enum, decided_by, decided_at). RLS through fn_leads_group / fn_is_admin: group
  leaders insert and read their group's requests, admins read and decide, members see nothing.
  Approval runs in a security definer function that applies the change to group_members.
  Screens: a "Request a change" action on the leader Roster tab, pending requests on the mobile
  Ministry admin screen (above the health board), and on the admin web Groups page. pgTAP:
  tenancy, members cannot read, leaders only for their own group.
- **Edit profile (mobile).** Settings > Edit profile: a man updates his own name and phone
  (RLS already allows it; only the screen is missing). Optional: suggest his phone from his
  matched PCO roster record for him to confirm. Never auto-write from PCO.
- **Check-in answered without opening the app.** The check-in push's 1 to 5 buttons open the
  app, which saves the answer. Saving in the background (expo-task-manager with
  opensAppToForeground false) is possible but less reliable; revisit after launch.
- **Mute ministry announcements per leader.** Settings > Notifications has one switch for all
  @everyone posts; a per-poster mute was considered and left out.
- **Scoring: admins with no group.** The job scores every ministry member, so an admin who is
  not in a group shows as Disconnected. Decide: skip men with no group and no role in one, or
  keep scoring them for the admin view only.
- **In-app video player for lessons.** Waits on the video provider decision (below).

## Decisions needed

- **Video provider:** Mux or Vimeo. Lessons open the video link until then.

## Setup (Kevin)

- **Test admin account before the first real PCO sync.** The real sync copies 332 men's
  names, emails, and phones; admin@manup.test has the password "password". Remove its admin
  role or change its password first.
- **Apply 0013, 0014, 0015** (after reviewing them): 0013 fixes @everyone (the database has
  an earlier 0012 draft where any leader post alerts everyone), 0014 adds check-ins and push,
  0015 sets up account deletion. Then `pnpm gen:types`.
- **Migration history.** `supabase login`, `supabase link --project-ref nvtclnspnhpbunrnjwya`,
  then `supabase migration repair --status applied 0001 ... 0015` (every migration applied by
  hand; until then prefix commands with APPLIED_MIGRATIONS=0001,...,0012).
- **New development build.** Slice 9 adds native modules (expo-notifications, expo-device,
  Sentry). The current dev client will crash on launch until `eas build --profile development`.
- **Push credentials.** iOS: an APNs key via `eas credentials`. Android: a Firebase project, its
  FCM V1 service account key uploaded to EAS, and google-services.json set as
  `android.googleServicesFile` in app.json. Without these, tokens register but nothing arrives.
- **Android notification icon.** A 96x96 white-on-transparent PNG, set as `icon` in the
  expo-notifications plugin (app.json); Android shows a plain square without it.
- **Push schedule.** ministry_config push_schedule for Man Up: check-in prompt Thursday 12:00,
  leader digest Monday 7:00, weekly questions Monday 9:00, meeting reminder 3 hours before,
  attendance prompt 2 hours after (America/New_York). Change the row to adjust.
- **Sentry.** Create the mobile and admin projects. Set EXPO_PUBLIC_SENTRY_DSN (EAS env) and
  NEXT_PUBLIC_SENTRY_DSN (Vercel), plus SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN as EAS
  secrets and Vercel env vars. Production EAS builds upload source maps and fail without them.
- **PCO Check-Ins event** for the Men's Ministry Meeting, then tick it on the admin
  Planning Center page (Saturday attendance starts counting).
- **Serve picks.** Admin Planning Center page: choose the Registrations categories or
  sign-ups that count as serving.
- **Sanity Studio.** Studio now lives in the admin site at /studio (no separate deploy). In
  sanity.io/manage > API > CORS origins, add http://localhost:3000 and the admin site's
  production URL, both with "Allow credentials". Then create the Ministry document (key
  `manup`) and point the webhook at <admin site>/api/sanity/webhook.
- **Inngest production keys** (INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY) when the admin site
  deploys.

## Before launch

- **Privacy policy review.** packages/shared/src/legal.ts is a draft: LFCC reviews it and fills
  in CONTACT_EMAIL (it shows "[contact email to be added]" until then). The store listings link
  to <admin site>/privacy; the guidelines are at /guidelines.
- **Store submission.** `eas build --profile production`, then `eas submit` (App Store Connect
  app record and Play Console listing first; both ask for the privacy policy URL, a demo
  account for review, and the content-reporting details: report, block, and admin review).
- `pnpm db:unseed` to remove all test data (and nothing else).
