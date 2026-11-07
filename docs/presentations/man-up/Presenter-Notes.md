# Man Up app presentation

Use the full main deck (slides 1–16) for a roughly 12-minute overview. For members, use slides 1–2 and 7–16. Slides 3–6 explain the leadership tools. Slide 17 is an optional launch-readiness appendix. Presenter notes are also embedded in the PowerPoint.

Slides 8, 9, 11, and 13 include six existing iPhone screenshots: Home, Gatherings, My Group, Prayer, Share a Request, and Serve & Events. Dates and sample content reflect the original captures, not the current schedule.

All slides use editable PowerPoint text and shapes, plus the existing ministry logo and app screenshots. No credentials are included. The preview is a layout proof generated from the same content and positions; PowerPoint may render fonts slightly differently.

## Slide 1

Opening, 30 seconds. The app helps men keep showing up and grow together between gatherings. Present the full deck to leaders. For the men, use slides 1–2 and 7–16. Slide 17 is an optional leadership appendix. This is a feature overview, not a statement that the app is already publicly released.

Source review: docs/product-map.md.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 2

40 seconds. This is the ministry journey the app supports, rather than a set of requirements a man must complete in a fixed order. Leaders make placement and promotion decisions through relationships. Church Center remains the place for registration, payments, giving, and official church records.

Source review: docs/product-map.md.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 3

55 seconds. The leader dashboard is scoped to his group. It shows engagement tiers and trends, an attendance grid, Needs a Call, 30-day contact coverage, and group check-in averages. The Needs a Call list includes men flagged Disconnected or trending down for three weeks, with new-member and season-of-life protections. Dashboard labels are prompts for care, never a diagnosis. The leader is also a group member and can read group chat and check-ins there.

Source review: apps/mobile/app/(app)/group/(leaders)/dashboard.tsx; apps/mobile/lib/scores.ts.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 4

60 seconds. Meetings follow the configured group cadence. Attendance can still be recorded after 72 hours, but the meeting no longer counts as held for scoring. From Roster, leaders can call, text, or log an in-person visit; returning from a call or text prompts logging. No conversation notes are stored. Season pauses are 14, 30, or 60 days. Discussion questions are viewed here and authored through the content workflow; do not promise an in-app question editor. Scheduled leader digests and attendance prompts require push configuration. Co-leader permissions follow group assignment and backend policy.

Source review: apps/mobile/app/(app)/group/(leaders)/attendance/[meetingId].tsx; apps/mobile/app/(app)/group/roster.tsx; apps/mobile/app/(app)/group/(leaders)/dashboard.tsx; apps/admin/src/lib/push/schedule.ts.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 5

55 seconds. The admin web includes Ministry health, Groups, People, Invitations, Reports, Content, Planning Center, and Scoring settings. Health shows group scores, risk triggers, weakest components, leader consistency, and season flags. The embedded content studio authors courses, lessons, gathering material, and weekly questions. Planning Center tools select source groups and relevant check-in events and serve signups, review syncs, and confirm people matches. Mobile admin supports placement, group management, and a glanceable health board. The automated leadership pipeline and progression funnel described in the product map are not presented as built here.

Source review: apps/admin/src/components/AdminNav.tsx; apps/admin/src/app/(admin)/health/page.tsx; apps/mobile/app/(app)/more/admin/index.tsx; apps/admin/src/app/(admin)/pco/page.tsx.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 6

60 seconds. A leader sees group chat and individual check-ins because he belongs to that group. Admins do not gain general access to private group conversations; reported items are available for moderation. Ministry-wide prayer posts and ministry chat are visible ministry-wide by design. Anonymous prayer hides the displayed author name; avoid describing it as technically untraceable. Lesson reflections stay private. A prayer comment can identify its own author even on an anonymous request. The transparency screen is available under Settings → What your leader sees.

Source review: apps/mobile/app/(app)/more/settings/leader-sees.tsx; apps/mobile/app/(app)/more/courses/[courseId]/[lessonId].tsx; packages/shared/src/score/index.ts.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 7

45 seconds. Do not promise an App Store download or share a QR code until the distribution link is confirmed. Sign-up captures the ministry choice or invite, and there is a recovery join screen if membership was not completed. Group placement is handled by ministry leadership. New men are not blocked from ministry chat or ministry-wide prayer while awaiting placement.

Source review: apps/mobile/app/(auth)/sign-up.tsx; apps/mobile/components/JoinChoicePicker.tsx; apps/mobile/app/join.tsx; apps/mobile/app/(app)/group/index.tsx.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 8

45 seconds. Gathering scheduling comes from the connected source. Topic, teacher, preparation, recap, and take-home material appear only when published. There is no implemented “I’m coming” button on the reviewed gathering screen; do not present attendance intent as a current feature. Home links to courses, but does not currently display a personalized next-lesson card. Screenshots are existing iPhone captures from the repository. Their dates, sample content, and displayed state reflect the captures, not a live demonstration or the current event schedule.

Source review: apps/mobile/app/(app)/index.tsx; apps/mobile/app/(app)/gatherings/[gatheringId].tsx; apps/mobile/store/ios-6.9/1-home.png; apps/mobile/store/ios-6.9/5-gatherings.png.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 9

45 seconds. Group size is intended to be about 4–8 men. Cadence is configurable, so avoid promising that every group meets weekly. Weekly check-ins are group-visible, not private messages to a leader. Members see their own attendance summary; the leader marks the group’s attendance. Screenshots are existing iPhone captures from the repository. Their dates, sample content, and displayed state reflect the captures, not a live demonstration or the current event schedule.

Source review: apps/mobile/app/(app)/group/index.tsx; apps/mobile/app/(app)/group/meetings.tsx; apps/mobile/app/(app)/group/roster.tsx; apps/mobile/app/(app)/group/checkin.tsx; apps/mobile/store/ios-6.9/2-my-group.png.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 10

45 seconds. Both chats support reporting and blocking through the safety menu. Ministry chat supports individual mentions. Ordinary leader posts do not automatically alert the whole ministry: @everyone is the explicit announcement action. All-message ministry chat pushes are optional and default off, whereas ministry announcements default on. Personal mentions are not muted by the in-app category settings, but phone notification permissions still apply.

Source review: apps/mobile/app/(app)/group/chat.tsx; apps/mobile/app/(app)/group/ministry-chat.tsx; apps/mobile/app/(app)/more/settings/notifications.tsx; supabase/migrations/0013_chat_everyone_fix.sql.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 11

45 seconds. Group visibility is the default for men who have a group; men without one can post ministry-wide. Request authors can change visibility, mark answered, and delete requests. Anonymous posting hides the request author’s name from the display; comments show their own authors. Requests and comments support reporting and blocking. Screenshots are existing iPhone captures from the repository. Their dates, sample content, and displayed state reflect the captures, not a live demonstration or the current event schedule.

Source review: apps/mobile/app/(app)/pray/new.tsx; apps/mobile/app/(app)/pray/[requestId].tsx; apps/mobile/components/PrayerCard.tsx; apps/mobile/store/ios-6.9/3-pray.png; apps/mobile/store/ios-6.9/4-share-request.png.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 12

40 seconds. The app currently opens the video URL rather than using an embedded player. Completion is manually marked; do not promise automatic video completion. Courses can be published through the content system. Stepping Up is a planned content example, not a guarantee that a specific course is populated or available in production.

Source review: apps/mobile/app/(app)/more/courses/index.tsx; apps/mobile/app/(app)/more/courses/[courseId]/index.tsx; apps/mobile/app/(app)/more/courses/[courseId]/[lessonId].tsx.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 13

45 seconds. Group claims and opt-ins coordinate participation; they do not replace official registration. Leaders can confirm exactly which men served. The connected Planning Center setup can also supply qualifying serve activity. The content and setup determine which opportunities appear. Screenshots are existing iPhone captures from the repository. Their dates, sample content, and displayed state reflect the captures, not a live demonstration or the current event schedule.

Source review: apps/mobile/app/(app)/more/serve/[opportunityId].tsx; apps/mobile/lib/serve.ts; apps/admin/src/app/(admin)/pco/page.tsx; apps/mobile/store/ios-6.9/6-serve.png.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 14

45 seconds. The current screen shows completed lessons, gatherings attended over 90 days, group meetings over 90 days, and times served, plus a next-step message. The D section points to a conversation about co-leading. It does not currently contain a full automated apprenticeship milestone tracker. No peer leaderboard is displayed. Leaders separately see attendance and engagement tiers for their own men.

Source review: apps/mobile/app/(app)/more/progress.tsx.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 15

40 seconds. Profile editing currently covers name and phone, not changing the sign-in email. The blocked list supports unblocking. In-app account deletion is implemented, but the production function and credentials must be configured and verified. Settings contains six notification categories. Mentions and required leader prompts do not follow all optional category toggles; device permissions still apply.

Source review: apps/mobile/app/(app)/more/settings/index.tsx; apps/mobile/app/(app)/more/settings/profile.tsx; apps/mobile/app/(app)/more/settings/notifications.tsx; apps/mobile/app/(app)/more/settings/blocked.tsx; apps/mobile/app/(app)/more/settings/delete-account.tsx.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 16

40 seconds. Close by inviting one practical action, then take questions. Before delivering this presentation, replace verbal download instructions with the actual approved distribution process. No release date, download URL, live metrics, or actual member names have been invented in this deck. If leaders ask about release readiness, use the optional appendix.

Source review: docs/product-map.md; docs/backlog.md.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

## Slide 17

Optional, 60 seconds. Repository documentation includes outstanding setup tasks; this deck does not audit a live deployment. Confirm migration state against current code because the backlog’s applied-version notes may lag later migrations. Push delivery requires production credentials and schedules; course and gathering content must be populated; Planning Center sources and matching must be configured. Review privacy copy, validate account deletion and moderation in a pilot, and confirm distribution. The product map includes future conveniences such as offline attendance and QR self-check-in; they are not demonstrated or promised here. Roster-change request approvals and embedded video are explicit backlog items.

Source review: docs/backlog.md; docs/product-map.md.
Based on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.

