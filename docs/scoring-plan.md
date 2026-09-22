# Man Up App: Engagement Scoring Plan

## Rating System for Men, Leaders, and Groups (v1.1)

Companion to the Product Map v1.2. This defines how the app turns raw activity into ratings leadership can act on. v1.1 revises the weights based on retention and engagement research, removes admin-compliance items from the leader score, raises serving, and adds recency weighting, velocity alerts, and a calibration loop.

---

## 1. Design Principles

1. **Shepherding, not surveillance.** Every score exists to answer one question: "Who needs attention, and what kind?" Scores are never shown to peers, never posted publicly, and never used to rank men against each other.
2. **Measure behavior, never content.** Attendance, taps, and completions count. What a man writes in chat or prays about never factors into any score.
3. **Tiers over numbers.** Leaders see plain-language tiers (Thriving, Steady, Drifting, Disconnected) with trend arrows. Raw scores exist under the hood for admins and tuning.
4. **Two instruments, two jobs.** The engagement score is a drift detector built on high-frequency weekly signals. LEAD is the maturity measure built on milestones. Serving matters in both but lives most heavily in LEAD, where it is an entire pillar. Trying to make one number do both jobs makes it bad at both.
5. **Recent behavior matters most.** Rolling windows plus recency weighting. A score can always fully recover.
6. **Grace is built in.** New men are not scored while they ramp. Excused absences count differently than silence. Leaders can flag a season of life that pauses alerts.

---

## 2. What the Research Says (and how it shaped the weights)

These are the findings this system is built on. None of them are exotic; they show up repeatedly across church assimilation research, engagement studies, and churn-prediction work in other fields.

**Serving predicts staying.** Church assimilation research (Thom Rainer's work on member retention, Larry Osborne's "sticky church" findings, Gallup's studies of congregational engagement) consistently finds that members who serve remain connected at far higher rates than attend-only members. Serving converts a consumer into a stakeholder. This is why serving rises from 10 to 20 points in v1.1 and remains a full pillar of LEAD.

**Relationships predict staying even more.** A widely cited church assimilation finding is that new members who form several genuine friendships in their first months almost always stay, while those who form none almost always leave, regardless of how good the preaching is. The group itself is the intervention. This is why group attendance remains the heaviest single component, and why the optional "relational ties" signal in section 8 exists.

**Recency beats history.** Churn-prediction models across industries (the RFM framework: recency, frequency, monetary) consistently find recency of engagement is the single strongest predictor of leaving. A man active 3 weeks ago and silent since is at more risk than a man with patchy but current activity. v1.1 adds recency weighting inside the 30-day window.

**Slope beats level.** Churn research also shows trajectory matters more than absolute score. A man falling from 85 to 65 is a louder alarm than a man holding steady at 50. v1.1 adds velocity alerts on consecutive declines, independent of tier.

**Leader contact outside meetings drives group stickiness.** Small-group research repeatedly finds that groups whose leaders touch members between meetings (a call, a text, coffee) retain members at much higher rates than groups that only see each other at the meeting. This becomes the heaviest component of the v1.1 leader score.

**Consistency beats intensity.** Habit-formation research favors small repeated behaviors over bursts. This is why participation is scored binary-per-week and capped: showing up a little every week outranks a flurry once a month.

**Engagement and maturity are different measurements.** Gallup's congregational research distinguishes engagement (belonging, participation) from spiritual commitment (transformation, service, discipleship). They correlate but move on different timescales. This is the justification for the score/LEAD split in principle 4.

**No model is right out of the box.** Every serious predictive system is calibrated against its own population's outcomes. Section 9 defines the validation loop. Treat v1.1 weights as an informed starting point, not settled truth.

---

## 3. Individual Engagement Score

**Purpose:** tell a group leader which of his men are connected and which are drifting, before the drift becomes disappearance.

**Window:** rolling 30 days for the score, 90-day trend line, with recency weighting inside the window.

### Components (100 points)

| Signal                   | Points | How it's earned                                                                                                                                                | Data source                                 |
| ------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Group meeting attendance | 30     | Present = full credit per meeting held. Excused = half credit. Absent = zero. Prorated by meetings held in the window.                                         | attendance                                  |
| Serving                  | 20     | Rolling 90-day window since serving is lower frequency. One confirmed serve in 90 days = 15 points. Two or more = 20.                                          | serve_participation                         |
| Weekly check-in          | 15     | Submitted the weekly check-in. Prorated by weeks in window, counting only weeks since he could check in (in a group, and after the ministry's first check-in). The 1 to 5 value itself is never scored, only that he checked in. | weekly_checkins                             |
| Gathering engagement     | 15     | "I'm coming" tap plus confirmed presence (PCO Check-Ins) at Saturday gatherings, scored as the share of gatherings in the window he attended (twice a month, so up to 2 in 30 days).                                                                                        | gathering_intents                           |
| Group participation      | 10     | Any activity in chat (group or ministry) or prayer wall that week (a message, a request, an "I prayed" tap). Binary per week, capped. Volume earns nothing extra. | messages, ministry_messages, prayer_requests, prayer_responses |
| Course pace              | 10     | On pace with enrolled course checkpoints. If not enrolled in any open course, these 10 points redistribute proportionally so unenrolled men are not penalized. | lesson_progress                             |

### Recency weighting

Weekly signals (attendance, check-in, participation) are weighted inside the 30-day window: the two most recent weeks count roughly double the two older weeks (week weights 4, 3, 2, 1, normalized). A man who was active early in the month and has gone silent scores visibly lower than a man building momentum, even if their raw activity counts match.

### Velocity alert (independent of tier)

Three consecutive weekly score declines put a man in his leader's Monday digest with a trend flag, even if he is still Steady or Thriving. Catching the slope early is worth more than any threshold.

### Tiers

| Tier         | Score     | What the leader sees             | System behavior                                   |
| ------------ | --------- | -------------------------------- | ------------------------------------------------- |
| Thriving     | 80 to 100 | Green. "Engaged and consistent." | Feeds the LEAD pipeline signal.                   |
| Steady       | 55 to 79  | Blue. "Connected."               | Nothing. This is normal and good.                 |
| Drifting     | 30 to 54  | Yellow. "Worth a check-in."      | Appears in the leader's weekly digest.            |
| Disconnected | 0 to 29   | Red. "Needs a call."             | Lands on the Needs a Call list with one-tap dial. |

### Grace rules

- **New member ramp:** first 30 days after joining a group, the man shows as "New" with no tier and no alerts. Score accrues but is not displayed until day 31.
- **Season flag:** a leader can set a season-of-life flag (required end date, max 60 days) that pauses tier-drop and velocity alerts. The man still appears on the roster with a small icon. Admins see all active flags.
- **Full recovery:** no history older than the window affects the score. Tiers always recover completely.

---

## 4. Leader Score (Shepherding Consistency)

**Purpose:** tell admins which leaders are shepherding and which are coasting, measured only on behaviors inside the leader's control. Admin-only, framed as consistency, never performance.

**Window:** rolling 60 days.

**v1.1 change:** "attendance marked promptly" is no longer a scored item. Marking attendance is data hygiene, not shepherding. It is now a gate instead: **a meeting only counts as held if attendance was marked within 72 hours.** Unmarked meetings vanish from the system, which hits the meetings-held component automatically. Data hygiene is enforced without pretending it is pastoral care. The freed points move to proactive contact, the behavior research most strongly ties to group stickiness.

### Components (100 points)

| Signal                       | Points | How it's earned                                                                                                                                                        | Why this signal                                                                                                                                                         |
| ---------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shepherding contact coverage | 35     | Every man on his roster has at least one logged contact (call, text, in person) in each rolling 30 days, proactive or responsive. Scored as percent of roster covered. | Leader touch between meetings is the strongest research-backed predictor of group stickiness. Breadth matters: the quiet middle of the roster, not just the red alerts. |
| Needs a Call follow-through  | 25     | Each man who lands on the Needs a Call list is marked contacted within 7 days.                                                                                         | The urgent subset of contact. This is the ministry's retention engine.                                                                                                  |
| Meetings held on cadence     | 25     | Group met on its stated rhythm. Held = attendance marked within 72 hours (the gate above).                                                                             | A group that does not meet cannot disciple, and unrecorded meetings are invisible to everyone downstream.                                                               |
| Personal engagement          | 15     | The leader's own individual score is Steady or better.                                                                                                                 | Leaders lead from example, and a leader whose own engagement is sliding is often the first sign he needs support or a break.                                            |

Contact logging stays one tap (called, texted, saw him) with no notes field. What was said stays between the two men.

### What is deliberately NOT in the leader score

- **His group's engagement numbers.** A leader assigned five struggling men should not score worse than one assigned five self-starters. Group outcomes live in the Group Health Score, where context is visible.
- **Group growth or size.** Scoring size makes leaders resist sending men out to seed new groups, which fights the multiplication model.
- **Retention.** A man moving, changing churches, or being launched to lead is not leader failure. Departures are reviewed by admins case by case.
- **Content preparation.** Weekly questions are pushed ministry-wide by default, so posting them measures nothing. Dropped in v1.1.

### Tiers

| Tier         | Score     | Admin action                                                                                    |
| ------------ | --------- | ----------------------------------------------------------------------------------------------- |
| Consistent   | 75 to 100 | None. Thank him occasionally.                                                                   |
| Inconsistent | 45 to 74  | Appears in monthly admin review for a supportive conversation.                                  |
| Inactive     | 0 to 44   | Direct conversation. Often means the leader himself needs shepherding, a co-leader, or a break. |

---

## 5. Group Health Score

**Purpose:** an at-a-glance board showing which groups are alive, which are wobbling, and which are dying quietly.

**Window:** rolling 60 days, 6-month trend.

### Components (100 points)

| Signal                    | Points | How it's computed                                                                                                                                     |
| ------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Average member engagement | 40     | Mean of the group's individual scores (excluding New and season-flagged men).                                                                         |
| Attendance rate           | 20     | Presents divided by (roster x meetings held).                                                                                                         |
| Meeting consistency       | 15     | Meetings held vs. cadence promised (marked-attendance gate applies).                                                                                  |
| Participation spread      | 15     | Percent of the roster active in any given week (chat, prayer, or check-in). Catches the "three guys carry the group" failure mode that averages hide. |
| Roster stability          | 10     | No unexplained departures in the window. Men launched to lead or transferred by admin do not count against it.                                        |

### Health bands

| Band    | Score     | What admins see          | Trigger                                            |
| ------- | --------- | ------------------------ | -------------------------------------------------- |
| Healthy | 75 to 100 | Green tile.              | Candidate to launch a co-leader and multiply.      |
| Watch   | 50 to 74  | Yellow tile.             | Monthly review, with the weak component named.     |
| At Risk | 0 to 49   | Red tile, sorted to top. | Admin conversation with the leader within 2 weeks. |

### Automatic at-risk triggers (override the score)

- No meeting held in 21 days
- Attendance below 50 percent for 3 consecutive meetings
- Zero group activity (chat, prayer, check-ins) for 14 days
- Leader score falls to Inactive

---

## 6. What Leadership Sees, and When

| Audience     | View                                                                                                                                | Rhythm                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Member       | His own tier and trend only, framed as "your next step," never as a grade. Never sees another man's tier.                           | Always available on My Progress.                                                                 |
| Group leader | His men's tiers, trend arrows, velocity flags, Needs a Call list, contact coverage tracker, group pulse. Nothing outside his group. | Weekly digest push Monday morning: "2 men worth a check-in, 3 men not yet contacted this month." |
| Admin        | Group health board, leader consistency tiers, ministry funnel, all alerts, active season flags.                                     | Live dashboard plus a monthly review packet.                                                     |

**Monthly admin review (30 minutes, you and Min. James):** walk the health board top-down. Red groups first, then yellow, then celebrate green and pick multiplication candidates. The dashboard prepares the agenda automatically.

**Quarterly recalibration:** review weights and thresholds against reality (section 9). All weights live in score_config, so tuning is a data change, not a deploy.

---

## 7. Hard Rules (Cultural Guardrails)

1. No score, tier, or ranking is ever visible member-to-member. No leaderboards, ever.
2. Prayer and chat content never influence any score. Participation counts; words do not.
3. The check-in value (a man saying "I'm at a 2 this week") never lowers his score. Honesty must never be penalized. Struggling and engaged is the system working.
4. Scores are conversation starters, not verdicts. Every alert routes to a human phone call.
5. Tiers always fully recover. No permanent record.
6. If the system ever makes a leader feel graded rather than supported, the framing has failed and gets fixed at the monthly review.

---

## 8. Optional Future Signal: Relational Ties

Given how strongly friendship-count predicts retention in assimilation research, a later version could track a light relational-connectedness signal: the number of distinct men a member has interacted with (prayer responses, chat replies, confirmed contacts) in 60 days. A man connected to one person is one schedule change away from gone; a man connected to five is woven in. Do not build this in v1; it adds complexity and borders on measuring relationships themselves. Revisit after two quarters of real data if drift detection is missing men the leaders say "seemed fine."

---

## 9. Calibration Loop (how the algorithm actually gets good)

No starting weights are correct; they become correct through validation against your own men. Every 6 months, run the check:

1. **Backtest drift detection.** Of the men who actually left or went dark in the period, what percent were flagged Drifting or Disconnected at least 3 weeks beforehand? Target: 80 percent or better. Every miss gets a post-mortem: what signal existed that the score ignored?
2. **False alarm rate.** Of men flagged Drifting, how many were genuinely fine (verified by their leader)? If leaders learn to ignore yellow, the system is dead. Target: under 30 percent false alarms.
3. **Thriving validation.** Are Thriving men actually the ones leaders would name as most engaged? Spot-check with 3 leaders.
4. **Leader score fairness.** Ask leaders directly at a quarterly gathering: does this feel like support or grading? Adjust framing and weights accordingly.
5. **Tune in score_config.** Adjust weights, thresholds, and windows as data changes, not code deploys. Log every change with a reason.

The first calibration (roughly 6 months after Phase 2 ships) matters most. Expect to adjust: the Drifting threshold, the serving graduation (15/20 split), and the contact coverage expectation are the three most likely to need tuning.

---

## 10. Implementation Notes (Supabase)

**New tables:**

```
score_config
  id, key (e.g. 'individual.attendance.weight'), value (numeric), updated_at, updated_by

individual_scores
  id, profile_id (fk), period_end (date), components (jsonb), score, tier,
  trend (up|flat|down), velocity_flag (bool), computed_at
  -- one row per man per week; 12 months retained

leader_scores
  id, profile_id (fk), group_id (fk), period_end, components (jsonb), score, tier, computed_at

group_scores
  id, group_id (fk), period_end, components (jsonb), score, band,
  at_risk_triggers (jsonb), computed_at

contact_log
  id, profile_id (fk, the man contacted), leader_id (fk),
  method (call|text|in_person), context (proactive|needs_a_call), created_at
  -- powers both contact coverage and Needs a Call follow-through; no notes field by design

season_flags
  id, profile_id (fk), set_by (fk), starts_on, ends_on (required, max 60 days), created_at
```

**Computation:** one scheduled Inngest function (served from apps/admin) runs Sunday night: computes all three score types with recency weights, writes rows, compares to prior weeks for trends and velocity flags, queues Monday leader digests via Expo push. The 72-hour attendance-marking gate is enforced here: meetings without marked attendance are excluded from "held."

**RLS:** members read own individual_scores. Leaders read individual_scores for their group members, their own leader_scores, and write contact_log. Admins read everything.

**Build order:** scoring dashboards ship in Phase 2, but two Phase 1 requirements exist because scores need history: attendance capture and the contact_log (now covering proactive contacts, not just alerts). Everything else computes retroactively.

---

## 11. Worked Example

Marcus joined a group June 1. Through June he shows as "New." In July he attends 3 of 4 meetings including the two most recent (recency-weighted, about 25 of 30), served once at the food drive (15 of 20), checked in 3 of 4 weeks (11 of 15), attended the July gathering (15 of 15), tapped "I prayed" twice (about 7 of 10), and is not enrolled in a course (10 points redistribute). He lands in the low 80s: **Thriving**, and because he has served and is consistent in his group, he is already accruing LEAD milestones.

In September his shifts change. Week one he misses the meeting and skips check-in; week two the same; week three he is silent everywhere. The velocity flag fires after week two, before his tier has even left Steady, and his leader sees "Marcus, trending down 2 weeks" in the Monday digest. The leader taps his name, calls, learns about the schedule change, logs "called," and Marcus gets moved to a group meeting on his off day. His leader's contact coverage credit is earned, and Marcus never actually reaches Disconnected.

That is the v1.1 difference in one story: the old design caught Marcus at the bottom of the slide. Velocity plus recency catches him near the top of it.
