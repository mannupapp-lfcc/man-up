# Man Up Backlog

Open items that are not part of a build-order slice yet. Newest decisions first within
each section. When an item is done, delete it (git history keeps the record).

## To build

- **Edit profile (mobile).** Settings > Edit profile: a man updates his own name and phone
  (RLS already allows it; only the screen is missing). Optional: suggest his phone from his
  matched PCO roster record for him to confirm. Never auto-write from PCO.
- **Weekly check-in.** Ships with slice 9 (see CLAUDE.md build order).
- **Ministry chat push delivery.** Ships with slice 9. 0011 already queues who to alert in
  ministry_message_alerts (tagged men; everyone when a leader posts). The slice 9 sender reads
  unsent rows with the service role, builds the text from the message at send time, pushes
  via Expo, and sets sent_at. Also consider a mute-leader-posts setting per man.
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
- **Migration history.** `supabase login`, `supabase link --project-ref nvtclnspnhpbunrnjwya`,
  then `supabase migration repair --status applied 0001 ... 0010`.
- **PCO Check-Ins event** for the Men's Ministry Meeting, then tick it on the admin
  Planning Center page (Saturday attendance starts counting).
- **Serve picks.** Admin Planning Center page: choose the Registrations categories or
  sign-ups that count as serving.
- **Sanity Studio.** Create the Ministry document (key `manup`), `pnpm --filter studio deploy`,
  and the webhook once the admin site is on Vercel.
- **Inngest production keys** (INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY) when the admin site
  deploys.

## Before launch

- `pnpm db:unseed` to remove all test data (and nothing else).
