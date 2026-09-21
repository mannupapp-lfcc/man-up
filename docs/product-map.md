# Man Up App

## Full Product Map v2.0

_Companion document: Engagement Scoring Plan v1.1 (defines the individual, leader, and group scoring system referenced below)._

**Ministry:** Man Up Men's Ministry, Love First Christian Center (Min. James Averitte)
**Vision alignment:** Building Godly Men, Strengthening Families, Transforming Communities
**Motto:** "Building Men of Faith, Developing Leaders of Purpose."
**Anchor scripture:** Proverbs 27:17, iron sharpens iron

---

## 1. Core Concept

The app is **not** a church app, an announcement board, or a registration system. It answers one question for every man in the ministry:

> "Where am I, and what's my next step?"

**The ladder:**

```
Attend a gathering > Join a group > Serve >
Take a course (Stepping Up) > Lead and mentor others
```

The top rung is the multiplication model. The app exists to move men up this ladder and to give leaders visibility into who is moving, who is stuck, and who is ready to lead.

### The Church Center boundary (non-negotiable)

**Church Center owns signups. Man Up owns discipleship.**

| Stays in Church Center                      | Lives in Man Up                                 |
| ------------------------------------------- | ----------------------------------------------- |
| Event registration & RSVPs requiring signup | Groups (roster, chat, attendance, questions)    |
| Retreat registration & payments             | LEAD progress tracking                          |
| Serve team applications                     | Group-level attendance                          |
| Giving                                      | Prayer wall (group-scoped)                      |
| Official event check-in / attendance        | Course delivery (Stepping Up, Husband Playbook) |
| Member database of record                   | Leader & admin dashboards                       |

The app **deep-links** into Church Center for anything transactional. It never rebuilds a signup. Positioning line for leadership: _"This sends men to Church Center more often, not away from it. It handles what happens between Saturdays."_

---

## 2. Roles & Permissions

Three roles, stored as a `role` field on the profile record, enforced with Supabase Row Level Security.

### Member

- Sees: his own profile, his own LEAD progress, his group (roster, chat, questions, prayer wall), gatherings, serve opportunities, courses he's enrolled in.
- Never sees: any other man's attendance, engagement data, or progress. No dashboards.
- **"What your leader sees" screen** in settings: plain-language statement that leaders see attendance and activity level only, and that prayer requests, chat messages, and check-in values are never visible outside the group, with one stated exception: "an admin can only see a prayer post or message if someone in your group reports it." Precise honesty is what makes the promise believable.
- **Account deletion** in settings: full in-app account and data deletion (App Store requirement).

### Co-Leader (apprentice)

- The development rung between member and leader. Every group should have one; it is both the leadership pipeline and succession insurance.
- Can: mark attendance, post the week's questions, view the group dashboard read-only.
- Cannot: change the roster, set season flags, or see other groups.
- Co-leading accrues the D-step apprenticeship milestones below.

### Group Leader

- Everything a member sees, plus a **dashboard scoped to his group only**:
  - Group attendance history (who showed, who didn't, streaks and gaps)
  - His men's engagement tiers with trend arrows and velocity flags (per the Scoring Plan)
  - Needs a Call list plus a contact coverage tracker (which men he hasn't touched in 30 days)
  - His men's LEAD progress (to know who's ready for the next step)
- Cannot see other groups or ministry-wide numbers.
- Can: mark attendance (within 72 hours or the meeting doesn't count as held), log contacts with his men (one tap: called, texted, in person; no notes field), set season-of-life flags, post weekly discussion questions (or use the ministry defaults), and request roster changes (admin approves).

### Ministry Admin (Min. Averitte, Kevin, +1 or 2 max)

- Full ministry-wide dashboard:
  - All groups' health (attendance %, activity, leader responsiveness)
  - Trends across the ministry (gathering interest over time, progression funnel)
  - Leader pipeline: men whose LEAD progress makes them leader candidates
  - Groups at risk (declining attendance, quiet chat, inactive leader)
- Manages: groups (create/close/merge), role assignments, course publishing, gathering entries, serve opportunity listings.

### Privacy wall (applies to every role including admin)

- **Prayer request content never rolls up into any dashboard.** Engagement signals only (attendance, activity), never spiritual content. The author chooses who sees each prayer request: his group (the default) or the whole ministry. It never goes beyond his ministry.
- Chat content is not surfaced in dashboards, only activity level (e.g., "active this week: yes/no").
- **The single exception is the report path:** when a group member reports a prayer post or message, that specific item becomes visible to admins for moderation review via content_reports, and that access is inherently logged. Admins never gain browse access to any prayer wall or chat; they see reported items only.
- **Safety design:** the wall is never unwatched, because the group leader is a member and sees everything, and carries the crisis protocol. Oversight flows through the shepherd in the room, not through database access. Visibility also creates responsibility: admins not having browse access is deliberate liability hygiene, not an oversight gap.
- This policy is ratified by ministry leadership via the presentation document (which states it plainly) and stated out loud in the approval conversation, so no one discovers it mid-conflict.

---

## 3. Modules (Member-Facing)

### 3.1 Home

- Personalized landing: next Saturday gathering card, "My Group" card with next meeting, current course lesson, one nudge tied to the man's next LEAD step.
- **Not-yet-placed state:** a man in no group sees "Get connected to a group" as the lead card. One tap notifies admins, and he appears on the admin unplaced list until placed. Getting a new man into a group fast is the app's single most important job for him.
- MAN UP acronym and motto woven into branding, not screen clutter.

**Screens:** Home feed.

### 3.2 Gatherings

- Next Saturday gathering front and center: topic, teacher, location. Gatherings are twice a month (after the fall Men Stepping Up season; monthly on the 2nd Saturday before that). The schedule lives in PCO: gatherings mirror the Men's Ministry group's events, so a schedule change needs no app change.
- Pre-work: 2 or 3 discussion questions posted before the gathering so men come prepared.
- "I'm coming" tap = attendance _intent_ for leader visibility (not a registration record).
- If an event requires registration (retreats, special events): **"Register on Church Center" deep link.** No in-app registration ever.
- Post-gathering recap: notes/summary plus take-home questions that flow into that week's group discussion. This connects the big room to the small group.

**Screens:** Gatherings list > Gathering detail (pre/post states).

### 3.3 My Group (the heart of the app)

Fixed groups of roughly 4 to 8 men.

- **Roster:** names, photos, contact preferences.
- **Meetings & attendance:** leader marks attendance per meeting; members see their own streak only.
- **Weekly discussion questions:** pushed ministry-wide by admin (tied to the last gathering's teaching) or customized by the leader.
- **Group chat:** simple chat with push notifications. Purpose-built, not a Discord clone. Long-press any message to report it (routes to admins); users can block another member (App Store requirement for user-generated content).
- **Weekly check-in:** a lightweight "How are you really doing?" one-tap scale plus optional note, visible to the group. Gives the leader a pastoral radar without being surveillance.

**Screens:** My Group > Chat / Meetings / Questions / Roster tabs.

### 3.4 Pray

- Prayer wall **scoped by the author's choice:** his group (default) or the whole ministry, per request. Never public, never another ministry. Anonymous hides his name either way, and a man with no group yet can still share ministry-wide.
- Post a request > the men tap "I prayed" (with count) > author can mark **"Answered"** with a short testimony. Posts are reportable, same moderation path as chat.
- Answered prayers get a subtle celebration state. This builds a faith history inside the group.
- Optional: ministry-wide praise report feed, opt-in per post, admin-moderated. (Phase 3, only if wanted.)

**Screens:** Prayer wall. Recommend a top-level tab labeled "Pray" for prominence, matching the Prayer Life pillar in the welcome letter.

### 3.5 Courses

- Course engine: video lessons plus weekly checkpoints, run with a start date and usually tied to a group, not solo binge-watching.
- **Course 1: Stepping Up** (August launch, the forcing function for Phase 2).
- **Course 2 (later): Husband Playbook.** The 21-day video course plus 50-day challenge fits this engine natively.
- Lesson page: video, key scripture, 2 or 3 reflection questions, "mark complete."
- Completion feeds the L step of LEAD.

**Screens:** Courses list > Course detail > Lesson player > Checkpoint.

### 3.6 Serve

- Curated list of serve opportunities relevant to the men's ministry.
- Each card: what/when/why it matters > **deep link to the Church Center signup form.**
- **Group serve projects:** a leader (or co-leader) claims an opportunity for the whole group ("we're taking the food drive on the 19th"). His men opt in with one tap, each still registers through Church Center, and the group is confirmed together afterward. Men bond shoulder to shoulder; this is the module's real connective feature, not the solo signup.
- After serving, the leader or admin confirms participation (solo or group). This feeds the A step of LEAD, and group serves also count toward the group's participation spread.

**Screens:** Serve list > Opportunity detail (external link out) > Group claim sheet.

### 3.7 My Progress (LEAD)

Each man's visible growth map, straight from the vision statement. Not gamification: no confetti, no leaderboards, no comparing men to each other.

| Step                                           | Meaning                     | Tracked signal                                                                                                                                |
| ---------------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **L, Learn God's Word** (Josh 1:8)             | Completing teaching content | Course/lesson completion; gathering attendance                                                                                                |
| **E, Encourage One Another** (Heb 10:24-25)    | Active in his group         | Group attendance streak; weekly check-ins                                                                                                     |
| **A, Act with Integrity** (Prov 10:9)          | Faith in action             | Confirmed serve participation                                                                                                                 |
| **D, Disciple Future Leaders** (Matt 28:19-20) | Multiplication              | Apprenticeship: co-lead 8+ weeks, run attendance twice, facilitate discussion twice, complete leader orientation; then launch or lead a group |

- Each step has 2 to 4 concrete milestones (e.g., E: "Attend 8 group meetings," "Complete 6 weekly check-ins").
- Visible to: the man himself, his group leader, and admins. Never to peers.
- When a man completes L+E+A, he surfaces on the admin **leader pipeline**. The human conversation ("we see leadership in you") stays human; the app just makes sure nobody ready gets overlooked.

**Screens:** My Progress (progress view with the current next step highlighted).

---

## 4. Leader Dashboard (Group-Scoped, lives in the app)

**Access:** `role = leader`, RLS-restricted to groups where he is the assigned leader. This dashboard is mobile by design: the shepherding loop (digest push > see tiers > tap to call > log contact) only works on a phone. It never moves to the web.

**Sections:**

1. **This week:** next meeting, who's confirmed, this week's questions.
2. **My men:** each man's engagement tier (Thriving / Steady / Drifting / Disconnected), trend arrow, and velocity flag when someone declines 3 straight weeks. Tiers and mechanics defined in the Scoring Plan.
3. **Attendance grid:** last 8 meetings by roster. Visual streaks and gaps.
4. **Needs a call:** men who hit Disconnected or a velocity flag. One tap to call or text, one tap to log the contact. The single most important feature for retention.
5. **Contact coverage:** which roster men have no logged contact in the rolling 30 days. Feeds the leader's own consistency score.
6. **My men's progress:** each member's LEAD position and next milestone.
7. **Group pulse:** aggregate check-in trend (are my guys okay?). Trend only; individual check-ins stay visible as posted in the group.
8. **Monday digest:** weekly push summarizing items 2 to 5 ("2 men worth a check-in, 3 not yet contacted this month").

**Explicitly absent:** other groups, ministry totals, prayer content analytics, chat transcripts.

---

## 5. Admin Dashboard (Ministry-Wide, lives on the web)

**Access:** `role = admin`. Built as a Next.js web app on Vercel, a second client of the same Supabase (same auth, same RLS, no separate API). Admin work is data-dense, form-heavy, done at a desk by 2 to 4 people, and web features ship instantly with no App Store review. The monthly review with Min. Averitte runs from this screen.

A slim admin surface remains in the mobile app for the two things that can't wait for a desk: approving roster change requests and a glanceable group health board. Everything else is web-only.

**Sections:**

1. **Ministry pulse:** active men (30-day), gathering interest trend, group participation rate, course enrollment and completion.
2. **Group health board:** every group's Group Health Score and band (Healthy / Watch / At Risk) per the Scoring Plan, with automatic at-risk triggers surfaced. Sort by at-risk.
3. **Leader pipeline:** men who've completed L+E+A milestones, the candidates for co-leading. One tap assigns a candidate as co-leader of his group (or another) after the human conversation happens. The pipeline tracks each apprentice's D-step milestones so admins know who is ready to launch. This screen _is_ the multiplication model.
4. **Progression funnel:** how many men at each ladder stage and where the drop-off is (e.g., "62 attend gatherings, 31 in groups, 12 serving" tells you exactly where to focus).
5. **Content controls:** authored in Sanity Studio (section 12); the dashboard handles scheduling pushes and operational toggles only.
6. **Leader consistency:** each leader's shepherding consistency tier (Consistent / Inconsistent / Inactive), admin-only.
7. **Group & role management:** create/close groups, assign leaders, approve roster changes, view active season flags.
8. **Score tuning:** edit weights, thresholds, and windows in score_config (quarterly recalibration; every change logged).

---

## 6. Data Model (Supabase / Postgres)

Multi-tenant from day one (see section 11): every domain table below carries a `ministry_id` (omitted from the listings for readability). Roles move off the profile and onto ministry membership.

```
organizations
  id, name (e.g. 'Love First Christian Center'), created_at

ministries
  id, organization_id (fk), name (e.g. 'Man Up'), status (active|archived), created_at

ministry_config
  id, ministry_id (fk), key, value (jsonb), updated_at, updated_by
  -- branding (name, colors, motto, acronym), gathering cadence, copy strings
  -- (gendered language etc.), ChMS deep-link base URLs, milestone framework labels

ministry_members
  id, ministry_id (fk), profile_id (fk), role (member | co_leader | leader | admin),
  joined_at, left_at (nullable)
  -- a person can hold different roles in different ministries

invite_codes
  id, ministry_id (fk), code (unique, short), role_granted (default member),
  max_uses (nullable), uses, expires_at (nullable), created_by, created_at
  -- how a person lands in the right tenant at signup; the same mechanism
  -- a second church or ministry uses on day one

profiles
  id (uuid, = auth.users.id), organization_id (fk), full_name, phone,
  email, photo_url, pco_person_id (text, unique; set only by admin confirmation), created_at
  -- role removed: roles are per-ministry via ministry_members

groups
  id, name, status (active|closed), meeting_day, meeting_time,
  leader_id (fk profiles), created_at

group_members
  id, group_id (fk), profile_id (fk), joined_at, left_at (nullable)
  -- unique(group_id, profile_id) where left_at is null

group_meetings
  id, group_id (fk), meeting_date, notes (nullable)

attendance
  id, meeting_id (fk group_meetings), profile_id (fk), status (present|absent|excused)

gatherings
  id, sanity_id (unique, nullable), title, gathering_date, start_time, end_time,
  topic, teacher, location, pre_questions (jsonb), recap (text, nullable),
  church_center_url (nullable, present only if registration required)

gathering_intents
  id, gathering_id (fk), profile_id (fk), created_at   -- "I'm coming" taps

discussion_questions
  id, sanity_id (unique, nullable), week_of (date), source (admin|leader),
  group_id (nullable, null = ministry-wide), questions (jsonb)

messages
  id, group_id (fk), profile_id (fk), body, created_at
  -- keep flat; threads only if genuinely needed later

checkins
  id, group_id (fk), profile_id (fk), week_of, scale (1-5), note (nullable)

prayer_requests
  id, group_id (fk), profile_id (fk), body, status (open|answered),
  answered_note (nullable), created_at

prayer_responses
  id, prayer_request_id (fk), profile_id (fk), created_at   -- "I prayed" taps
  -- unique(prayer_request_id, profile_id)

courses
  id, sanity_id (unique), title, description, status (draft|open|archived),
  start_date (nullable)

lessons
  id, sanity_id (unique), course_id (fk), order, title, video_url, scripture,
  questions (jsonb)

enrollments
  id, course_id (fk), profile_id (fk), enrolled_at

lesson_progress
  id, enrollment_id (fk), lesson_id (fk), completed_at, reflections (jsonb, nullable)

serve_opportunities
  id, sanity_id (unique, nullable), title, description, event_date (nullable),
  church_center_url, status

group_serve_claims
  id, opportunity_id (fk), group_id (fk), created_by (fk), event_note, created_at

serve_participation
  id, opportunity_id (fk), profile_id (fk), claim_id (fk group_serve_claims, nullable),
  status (opted_in|reported|confirmed), confirmed_by (fk profiles, nullable)

lead_milestones
  id, ministry_id (fk), step, order, title, criteria (jsonb)
  -- framework is per ministry: Man Up uses L|E|A|D; another ministry defines its own steps

lead_progress
  id, profile_id (fk), milestone_id (fk), completed_at, source (auto|manual),
  confirmed_by (nullable)

-- Scoring system (Engagement Scoring Plan v1.1)

score_config
  id, ministry_id (fk), key (e.g. 'individual.attendance.weight'),
  value (numeric), updated_at, updated_by
  -- per ministry, so each ministry tunes its own weights
  -- all weights, thresholds, and windows; tune without redeploying

individual_scores
  id, profile_id (fk), period_end (date), components (jsonb), score, tier,
  trend (up|flat|down), velocity_flag (bool), computed_at
  -- one row per man per week; 12 months retained

leader_scores
  id, profile_id (fk), group_id (fk), period_end, components (jsonb),
  score, tier, computed_at

group_scores
  id, group_id (fk), period_end, components (jsonb), score, band,
  at_risk_triggers (jsonb), computed_at

contact_log
  id, profile_id (fk, the man contacted), leader_id (fk),
  method (call|text|in_person), context (proactive|needs_a_call), created_at
  -- powers contact coverage and Needs a Call follow-through; no notes field by design

season_flags
  id, profile_id (fk), set_by (fk), starts_on, ends_on (required, max 60 days),
  created_at

content_reports
  id, reporter_id (fk), target_type (message|prayer_request), target_id,
  reason, status (open|reviewed|actioned), reviewed_by (nullable), created_at
  -- App Store UGC requirement; routes to admin web

user_blocks
  id, blocker_id (fk), blocked_id (fk), created_at
  -- hides the blocked user's content from the blocker; admins notified on creation
```

### RLS strategy (summary)

- `profiles`: user reads own row; leaders read rows of members in their groups; ministry admins read profiles of their ministry's members only. All policies resolve role via `ministry_members`, and every policy filters on `ministry_id`, written once as a shared helper function and reused across tables.
- Group-scoped tables (`messages`, `checkins`, `attendance` via meeting to group): readable/writable only by members of that group. `prayer_requests` follow the author's `visibility` (group or ministry); responses follow the request. Admins **do not** get browse access to `messages` or group-only `prayer_requests` by policy (a ministry-wide request is visible to everyone in the ministry, admins included, because the author chose that). Enforce the privacy wall in the database, not just the UI.
- **Report exception policy:** admins can read a `prayer_requests` or `messages` row only when an open `content_reports` row targets it (policy joins through content_reports). Access is scoped to the reported item, never the surrounding wall or thread, and the report record itself is the audit log.
- `attendance`, `gathering_intents`, `lead_progress`: member reads own; leader reads his group's; admin reads all.
- Content tables (`gatherings`, `courses`, `lessons`, `serve_opportunities`, `lead_milestones`): readable by any authenticated user, admin-writable.
- Scoring tables: member reads own `individual_scores`; leader reads `individual_scores` for his group members plus his own `leader_scores`, and writes `contact_log` and `season_flags` for his group; `group_scores`, all `leader_scores`, and `score_config` are admin-only. The check-in scale value is excluded from all scoring queries by design.

Same pattern class as the LDP roles/permissions work, but simpler, since roles are flat and scoping is single-dimension (group membership).

### Scoring engine

One scheduled Inngest function (served from apps/admin) runs Sunday night: computes individual (recency-weighted, rolling 30 days), leader (rolling 60), and group (rolling 60) scores; writes score rows; compares against prior weeks for trend arrows, velocity flags (3 consecutive declines), and tier-drop alerts; enforces the 72-hour attendance-marking gate (unmarked meetings are excluded from "held"); and queues Monday morning leader digests via Expo push. Full formulas, tiers, grace rules, and the calibration loop live in the Scoring Plan.

---

## 7. Tech Stack

Reuse the Eagles Nest stack, proven and already shipped through both app stores:

- **App:** Expo / React Native (iOS + Android), TypeScript (members, leaders, slim admin surface)
- **Admin web:** Next.js on Vercel (full admin dashboard), same Supabase auth and RLS as the app
- **Backend:** Supabase (Postgres, Auth, RLS, Realtime for chat, Storage for photos and thumbnails)
- **Video:** host course video on Mux or Vimeo Pro (don't serve video from Supabase Storage); watch-completion webhooks drive automatic lesson progress
- **Push:** Expo Notifications with notification quick actions (check-ins answered from the notification itself)
- **Monitoring:** Sentry for crash and error reporting from day one
- **Releases:** EAS Update for over-the-air fixes between App Store releases
- **Content authoring:** Sanity Studio (courses, lessons, gatherings, question sets, serve descriptions) with one-way webhook sync into Supabase on publish; the app never reads from Sanity directly
- **Scheduled jobs and integrations:** Inngest functions served from the Next.js admin app (apps/admin) on Vercel, plus `profiles.pco_person_id`; Planning Center API (People sync, Check-Ins) in Phase 2, optional Anthropic API drafting content into Sanity as drafts for review
- **Deep links:** standard `Linking.openURL` to Church Center pages (URLs from ministry_config)

Deliberately absent: no separate backend server, no Redis, no third-party analytics. Inngest covers scheduled jobs (nightly PCO read sync, scoring), Next.js API routes in apps/admin cover webhooks; the score tables are the analytics.

---

## 8. Phased Build Plan

### Phase 1: Connect (target: launch alongside or just before Stepping Up, August 2026)

The minimum app that changes behavior.

- Auth + profiles + tenancy scaffolding (organizations, ministries, ministry_members with roles, open signup plus leader invite codes, namespaced storage)
- **My Group:** groups, roster, chat, meetings, attendance
- **Unplaced flow:** "get connected" home state + admin unplaced list (a new man must never sit in an empty app)
- **Gatherings:** list/detail, pre-questions, "I'm coming," Church Center deep links
- **Sanity Studio + publish webhook sync** for gatherings and weekly question sets (courses added to the Studio in Phase 2)
- **Pray:** group prayer wall with "I prayed" and answered states
- **Leader dashboard v1:** attendance grid + "needs a call" list
- **Contact log:** one-tap contact logging from day one (scores need this history before they can compute)
- **Phase 1 automations:** auto-generated meetings, one-tap pre-filled attendance push, QR gathering check-in, call-triggered contact prompts, notification quick-action check-ins
- Sentry + EAS Update wired in before launch
- Push notifications for meetings and weekly questions

- **Admin web v0 (Next.js/Vercel):** the minimum to operate: create groups, assign roles, generate invite codes, place unplaced men, review content reports, simple counts page
- **Store compliance set:** report/block, community guidelines, account deletion, privacy policy, "what your leader sees" screen
- **Offline attendance queue** + notification permission at group join

_Cut line: no courses, no serve, no LEAD tracking, no admin analytics beyond the counts page._

### Phase 2: Grow (Sept to Oct 2026)

- **Course engine + Stepping Up** content (start dates, weekly checkpoints)
- Weekly discussion questions pushed ministry-wide, tied to gathering recaps
- Weekly check-ins
- **Scoring engine + dashboards:** individual tiers, velocity flags, Monday digests, leader consistency view, group health board (computes retroactively from Phase 1 data)
- **Planning Center integration:** People sync + Check-Ins attendance flow
- **Video progress webhooks** + AI-drafted questions/recaps with admin approval
- **Admin web app v1 (Next.js/Vercel):** group health board, gathering trends, score_config tuning, group/role/invite management, unplaced list, sync monitoring

### Phase 3: Multiply (Q4 2026 to Q1 2027)

- **Co-leader role + apprenticeship milestones** (the D step made concrete; every group works toward having a co-leader)
- **Group serve projects** (leader claims an opportunity for the group; men opt in together)
- **LEAD tracking** (milestones, My Progress screen, auto-tracking from existing signals)
- **Serve module** with Church Center links + participation confirmation
- **Leader pipeline** screen for admins (fed by Thriving tiers + L+E+A milestones)
- Progression funnel analytics
- First scoring calibration review (roughly 6 months after Phase 2): backtest drift detection, false alarm rate, weight tuning
- **Serve confirmation via PCO registrations** + placement nudges
- Optional: auto-sync gathering events from PCO calendar; ministry-wide praise reports
- Husband Playbook loaded as course 2

### Validation gate before Phase 1 code

One month of low-tech dry run: run 2 or 3 groups on a group text, a shared question doc, and paper attendance. This confirms leaders will actually mark attendance and men will actually engage weekly. If leaders won't do it on paper, an app won't fix that. It'll just be a more expensive way to find out.

---

## 9. Success Metrics

| Goal      | Metric                                      | Healthy signal                           |
| --------- | ------------------------------------------- | ---------------------------------------- |
| Connect   | % of gathering attenders in a group         | climbing toward 50%+                     |
| Connect   | Weekly group attendance rate                | 70%+                                     |
| Grow      | Stepping Up completion rate                 | 60%+ (video courses usually die at ~15%) |
| Scale     | Men surfaced in leader pipeline per quarter | 3 to 5                                   |
| Scale     | New groups launched per year                | 2 to 4                                   |
| Retention | "Needs a call" list contacted within 7 days | 90%+ (leader behavior metric)            |

The single number to watch: **group participation rate.** Everything else follows from it.

---

## 10. Open Decisions (for the conversation with Min. Averitte)

1. **Group formation:** who assigns men to groups: self-select, leader invite, or admin placement? (Recommend admin placement with preference input; self-select produces cliques.)
2. **Check-in tone:** is the weekly 1 to 5 "how are you really" wanted, or too much structure for the culture?
3. **Attendance threshold** for the "needs a call" alert (14/21/30 days).
4. **Who the 3rd/4th admin is.** Keep this list very short.
5. Confirm nothing in scope steps on Church Center or any Planning Center rollout plans the church staff has.

---

## 11. Scaling Model (other ministries, other churches)

The app is built single-church but **multi-tenant-shaped**, because adding tenant keys on day one is cheap and retrofitting them later is a rebuild.

**Two-level tenancy:** organizations (churches) contain ministries (Man Up, a future women's ministry). Every domain table carries `ministry_id`; every RLS policy filters on it via one shared helper. A person belongs to an organization once and joins ministries through `ministry_members`, with a role per ministry, so ministries under one church never see each other's data.

**Ministry facts live in config, not code.** App name, colors, motto, acronym, gathering cadence, copy strings (including gendered language), milestone framework labels, scoring weights, and ChMS deep-link URLs all live in `ministry_config` and `score_config`. Adopting this for the women's ministry is a config-and-content exercise, not a rebuild. Church Center links are config values, not assumptions, since another church may run Breeze, CCB, or nothing.

**What is deliberately NOT built until there is a real second tenant:**

- No billing, subscriptions, or self-serve church onboarding
- No per-church white-label App Store builds (one binary; men pick their ministry at signup, or use an invite code)
- No cross-organization anything

**Tenant plumbing locked in from day one** (trivial now, painful to fix with live data):

- **Open signup, per ministry:** anyone can create an account and join a ministry whose `ministry_config` has `open_signup = true`, always as a member. Invite codes scoped to a ministry grant leader roles (co-leader, leader, admin), including promoting an existing member. Group content stays locked until an admin places him in a group.
- **Storage paths are namespaced** as `{ministry_id}/...` in Supabase Storage from the first photo uploaded, with storage policies matching the same RLS helper.
- **Push notifications resolve recipients through ministry membership**, never "all users," so a digest can never cross tenants.
- **The scoring job iterates per ministry**, reading that ministry's own score_config, so tenants tune independently and one ministry's recalibration never touches another's.

**Sequencing:** Phase 1 ships with the tenancy tables and one row in each (LFCC, Man Up). The only build-time cost is that queries carry `ministry_id` and RLS resolves roles through `ministry_members`. The proof that earns a second tenant is six months of Man Up data showing men moving from attending to leading; the schema just guarantees that day is a config flip, not a migration.

---

## 12. Content Architecture (Sanity + Supabase)

**Sanity authors, Supabase runs.** All human-written content (courses, lessons, gathering entries, weekly question sets, serve descriptions) is created and edited in Sanity Studio, which provides drafts, rich text, revision history, media handling, and scheduled publishing without building any admin content UI. All operational data (people, groups, progress, attendance, scores, chat, prayer) lives only in Supabase.

**One-way sync, app reads Supabase only:**

1. Editor publishes in Sanity Studio.
2. Sanity webhook fires to a Next.js API route in apps/admin (verified with SANITY_WEBHOOK_SECRET).
3. The route upserts the document into the matching Supabase table by `sanity_id`, routed to the right `ministry_id` via a required ministry reference field on every Sanity document.
4. The app reads Supabase exclusively: one API, one auth model, RLS intact, foreign keys intact (lesson_progress still references real lessons rows), and the scoring job never knows Sanity exists.

Publishing is live in the app within seconds, with no app release. Drafts never leak because only published documents sync. Deletions/unpublishes sync as status changes, never hard deletes, so progress history is preserved.

**AI drafting lands in Sanity, not in the app.** The transcript-to-content pipeline (section 13) writes draft documents into Sanity via its API, same pattern as the existing sermon-to-blog workflow. Review and publish happen in Studio; the human approval gate is the publish button.

**What stays in the in-app admin dashboard:** operational controls only: groups, roles, invite codes, placements, score_config, and scheduling when question sets push to groups. Sanity authors the questions; the app decides when they land.

**Multi-tenant:** one Studio, required `ministry` reference on every document type, sync routes by it. A future ministry gets role-scoped access in the same Studio, or its own dataset if harder separation is wanted. No schema change either way.

---

## 13. Data Automation

**Rule: automate capture, never judgment.** Any data point that depends on a human remembering to enter it will decay. The phone call, group placement, and the "we see leadership in you" conversation stay human; everything that feeds them gets captured automatically or in one tap.

### Phase 1 automations

- **Recurring meetings auto-generate** from the group's cadence in ministry_config. Leaders never create meetings.
- **One-tap attendance:** 2 hours after meeting time, the leader receives a push with the roster pre-checked (from confirmations and recent patterns); he unticks absences and confirms. Protects the 72-hour gate the whole scoring system depends on.
- **QR self check-in at gatherings:** code on screen, men scan themselves in (expo-camera).
- **Contact logging prompted by behavior:** tap-to-call from the app triggers a "log this contact?" prompt on return.
- **Check-ins via notification quick actions:** the weekly 1 to 5 answered directly from the push without opening the app.

### Phase 2 automations (Planning Center API)

- **People sync:** a nightly Inngest function reads the Man Up PCO group roster (GET only) into pco_roster and suggests matches to profiles by email/phone. Suggestions land pre-filled in the admin PCO Match queue; an admin confirms a suggestion or searches and matches manually. Only that confirmation sets profiles.pco_person_id; the sync never writes it. One member database, not two.
- **Gathering attendance from PCO Check-Ins:** official check-in data flows in automatically; the QR code becomes the fallback.
- **Course progress from video webhooks:** Mux/Vimeo completion events mark lessons done.
- **AI-drafted weekly questions and gathering recaps:** pipeline drafts from the teaching transcript into Sanity as draft documents (same pattern as the sermon-to-blog workflow); admin reviews and publishes in Studio, which syncs to the app. Human approval always required before anything reaches members.

### Phase 3 automations

- **Serve confirmation from PCO registrations** replaces manual leader confirmation.
- **Placement nudges:** members unplaced 14 days after joining surface on the admin list automatically.
- Scoring, LEAD milestones, digests, velocity flags: already fully automated via the Sunday scoring job.

### Never automated

- Messages to a struggling man (alerts route to a human, who calls)
- Group placement decisions
- Leader promotion conversations
- Anything derived from prayer or chat content

---

## 14. Launch Readiness Checklist

**Store compliance (blocking; must exist at review):**

- Report + block for all user-generated content (chat, prayer wall), with reports routing to the admin web (Apple guideline 1.2 / Google Play UGC policy)
- Community guidelines accepted at signup
- In-app account and data deletion
- Privacy policy URL and terms, written in plain language appropriate to pastoral data

**Trust:**

- "What your leader sees" transparency screen live at launch
- Crisis protocol one-pager for leaders (ministry ops document, not code): handling crisis disclosures in chat or prayer, when to escalate to Min. Averitte, when to act immediately. Exists before the first group chats.
- Leader onboarding: a 30-minute session plus quick-start guide covering the Monday digest, one-tap attendance, contact logging, and the crisis protocol

**Build practicalities:**

- Offline attendance: marking queues locally and syncs on reconnect (groups meet in dead zones; the 72-hour gate must not punish bad signal)
- Notification permission requested after value is shown (at group join), not on first launch
- Pilot: 2 to 3 weeks on TestFlight/internal testing with the paper-trial groups before ministry-wide launch
- In-app "report a problem" that emails the admin

**Governance and operations:**

- Publish under the church's Apple and Google developer accounts, never personal ones
- Store listing name will likely need a qualifier (e.g. "Man Up LFCC") due to name collisions; in-app brand stays "Man Up"
- Budget approved with leadership: Apple $99/yr, Google $25 once, Supabase Pro ~$25/mo, video hosting ~$10 to 60/mo, Sentry/Sanity free tiers (roughly $60 to 100/mo all-in)
- Supabase automated backups confirmed on; deletion policy documented (account deletion removes personal data; anonymized attendance counts may persist in group aggregates)

**Scope pressure valve:** if the August window tightens, cut convenience automations (QR check-in, call-prompted contact logging, notification quick-action check-ins) before touching moderation, account deletion, the unplaced flow, or one-tap attendance. Ship trust and the retention loop first; polish convenience later.

---

_Positioning line for leadership: "Church Center runs the church's operations. The Man Up app runs what happens between Saturdays: the groups, the discipleship, the path from attender to leader. The vision statement, made tappable."_
