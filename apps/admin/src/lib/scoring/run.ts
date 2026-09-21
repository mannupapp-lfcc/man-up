import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  groupBand,
  leaderTier,
  memberTier,
  scoreGroup,
  scoreLeader,
  scoreMember,
  trendOf,
  velocityAlert,
  type MemberTier,
  type ScoreConfig,
} from "@manup/shared";
import type { Database } from "@manup/shared";

type Db = SupabaseClient<Database>;
const DAY = 86_400_000;

// Pages through a query (Supabase returns at most 1000 rows per request).
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export type ScoringSummary = { ministryId: string; members: number; leaders: number; groups: number; asOf: string };

// Computes member, leader, and group scores for one ministry, against its own
// score_config. Reads counts and timestamps only: never message, prayer,
// reflection, or contact-note content.
export async function scoreMinistry(db: Db, ministryId: string, now = new Date()): Promise<ScoringSummary> {
  const configRows = await all<{ key: string; value: number }>((a, b) =>
    db.from("score_config").select("key, value").eq("ministry_id", ministryId).range(a, b));
  const config: ScoreConfig = Object.fromEntries(configRows.map((r) => [r.key, Number(r.value)]));
  const c = (k: string) => {
    const v = config[k];
    if (v === undefined) throw new Error(`score_config is missing "${k}"`);
    return v;
  };

  const asOf = now.toISOString().slice(0, 10);
  const lookbackDays = Math.max(c("individual.serving_window_days"), c("leader.window_days"), c("group.window_days"), 90);
  const since = new Date(now.getTime() - lookbackDays * DAY).toISOString();
  const gateMs = c("meeting.marked_within_hours") * 3_600_000;

  // ---------- Load (ids, timestamps, statuses only) ----------
  const [members, placements, groups, meetings, serves, gatherings, gatheringAttendance, checkinConfig,
    messages, ministryMessages, prayers, prayed, progress, lessons, contacts, flags, history] = await Promise.all([
    all<{ profile_id: string; role: string; profiles: { pco_person_id: string | null } | null }>((a, b) =>
      db.from("ministry_members").select("profile_id, role, profiles(pco_person_id)").eq("ministry_id", ministryId).is("left_at", null).range(a, b)),
    all<{ group_id: string; profile_id: string; joined_at: string; left_at: string | null; is_group_leader: boolean }>((a, b) =>
      db.from("group_members").select("group_id, profile_id, joined_at, left_at, is_group_leader").eq("ministry_id", ministryId).range(a, b)),
    all<{ id: string; status: string }>((a, b) => db.from("groups").select("id, status").eq("ministry_id", ministryId).range(a, b)),
    all<{ id: string; group_id: string; meeting_at: string; attendance_marked_at: string | null }>((a, b) =>
      db.from("meetings").select("id, group_id, meeting_at, attendance_marked_at").eq("ministry_id", ministryId)
        .gte("meeting_at", since).lte("meeting_at", now.toISOString()).range(a, b)),
    all<{ profile_id: string; served_at: string }>((a, b) =>
      db.from("serve_logs").select("profile_id, served_at").eq("ministry_id", ministryId).gte("served_at", since.slice(0, 10)).range(a, b)),
    all<{ gathering_at: string }>((a, b) =>
      db.from("gatherings").select("gathering_at").eq("ministry_id", ministryId).eq("canceled", false)
        .gte("gathering_at", since).lte("gathering_at", now.toISOString()).range(a, b)),
    all<{ pco_person_id: string; event_at: string }>((a, b) =>
      db.from("pco_gathering_attendance").select("pco_person_id, event_at").eq("ministry_id", ministryId).gte("event_at", since).range(a, b)),
    db.from("ministry_config").select("value").eq("ministry_id", ministryId).eq("key", "pco_checkin_event_ids").maybeSingle(),
    all<{ profile_id: string; created_at: string }>((a, b) =>
      db.from("group_messages").select("profile_id, created_at").eq("ministry_id", ministryId).gte("created_at", since).range(a, b)),
    all<{ profile_id: string; created_at: string }>((a, b) =>
      db.from("ministry_messages").select("profile_id, created_at").eq("ministry_id", ministryId).gte("created_at", since).range(a, b)),
    all<{ profile_id: string; created_at: string }>((a, b) =>
      db.from("prayer_requests").select("profile_id, created_at").eq("ministry_id", ministryId).gte("created_at", since).range(a, b)),
    all<{ profile_id: string; created_at: string }>((a, b) =>
      db.from("prayer_interactions").select("profile_id, created_at").eq("ministry_id", ministryId).gte("created_at", since).range(a, b)),
    all<{ profile_id: string; lesson_id: string; completed_at: string | null }>((a, b) =>
      db.from("lesson_progress").select("profile_id, lesson_id, completed_at").eq("ministry_id", ministryId).range(a, b)),
    all<{ id: string; course_id: string }>((a, b) =>
      db.from("lessons").select("id, course_id").eq("ministry_id", ministryId).eq("is_published", true).range(a, b)),
    all<{ profile_id: string; leader_id: string; contacted_at: string }>((a, b) =>
      db.from("contact_logs").select("profile_id, leader_id, contacted_at").eq("ministry_id", ministryId).gte("contacted_at", since).range(a, b)),
    all<{ profile_id: string; starts_on: string; ends_on: string }>((a, b) =>
      db.from("season_flags").select("profile_id, starts_on, ends_on").eq("ministry_id", ministryId).lte("starts_on", asOf).gte("ends_on", asOf).range(a, b)),
    all<{ profile_id: string; as_of: string; total: number; tier: string; velocity_alert: boolean; is_new: boolean; paused: boolean }>((a, b) =>
      db.from("member_scores").select("profile_id, as_of, total, tier, velocity_alert, is_new, paused").eq("ministry_id", ministryId)
        .lt("as_of", asOf).gte("as_of", since.slice(0, 10)).order("as_of", { ascending: false }).range(a, b)),
  ]);
  if (checkinConfig.error) throw new Error(checkinConfig.error.message);
  const checkinsConfigured = Array.isArray(checkinConfig.data?.value) && checkinConfig.data.value.length > 0;

  // ---------- Shared lookups ----------
  const t = (iso: string) => new Date(iso).getTime();
  const within = (iso: string, days: number) => t(iso) <= now.getTime() && t(iso) > now.getTime() - days * DAY;
  const isHeld = (m: (typeof meetings)[number]) =>
    !!m.attendance_marked_at && t(m.attendance_marked_at) - t(m.meeting_at) <= gateMs;
  const heldMeetings = meetings.filter(isHeld);
  const heldIds = heldMeetings.map((m) => m.id);

  const attendance: { meeting_id: string; profile_id: string; status: string }[] = [];
  for (let i = 0; i < heldIds.length; i += 200) {
    const chunk = heldIds.slice(i, i + 200);
    attendance.push(...(await all<{ meeting_id: string; profile_id: string; status: string }>((a, b) =>
      db.from("meeting_attendance").select("meeting_id, profile_id, status").in("meeting_id", chunk).range(a, b))));
  }
  const statusOf = new Map(attendance.map((r) => [`${r.meeting_id}:${r.profile_id}`, r.status]));

  const currentGroup = new Map(placements.filter((p) => !p.left_at).map((p) => [p.profile_id, p]));
  const memberAt = (profileId: string, groupId: string, at: string) =>
    placements.some((p) => p.profile_id === profileId && p.group_id === groupId && t(p.joined_at) <= t(at) && (!p.left_at || t(p.left_at) > t(at)));
  const flagged = new Set(flags.map((f) => f.profile_id));
  const historyOf = (pid: string) => history.filter((h) => h.profile_id === pid);

  const activityOf = new Map<string, Date[]>();
  for (const r of [...messages, ...ministryMessages, ...prayers, ...prayed]) {
    const list = activityOf.get(r.profile_id) ?? [];
    list.push(new Date(r.created_at));
    activityOf.set(r.profile_id, list);
  }

  const lessonsByCourse = new Map<string, string[]>();
  for (const l of lessons) lessonsByCourse.set(l.course_id, [...(lessonsByCourse.get(l.course_id) ?? []), l.id]);
  const courseOfLesson = new Map(lessons.map((l) => [l.id, l.course_id]));

  // ---------- Members ----------
  const memberWindow = c("individual.window_days");
  const memberRows = members.map((mm) => {
    const pid = mm.profile_id;
    const myMeetings = heldMeetings
      .filter((m) => within(m.meeting_at, memberWindow) && memberAt(pid, m.group_id, m.meeting_at))
      .map((m) => ({ meetingAt: new Date(m.meeting_at), status: (statusOf.get(`${m.id}:${pid}`) ?? null) as "present" | "excused" | "absent" | null }));

    const personId = mm.profiles?.pco_person_id ?? null;
    const heldGatherings = gatherings.filter((g) => within(g.gathering_at, memberWindow));
    const attendedDays = new Set(
      gatheringAttendance.filter((a) => a.pco_person_id === personId && within(a.event_at, memberWindow)).map((a) => a.event_at.slice(0, 10)),
    );
    const gatheringsInput = personId && checkinsConfigured && heldGatherings.length
      ? { held: heldGatherings.length, attended: heldGatherings.filter((g) => attendedDays.has(g.gathering_at.slice(0, 10))).length }
      : null;

    // Enrolled = has progress in a course he has not finished.
    const mine = progress.filter((p) => p.profile_id === pid);
    const started = new Set(mine.map((p) => courseOfLesson.get(p.lesson_id)).filter((x): x is string => !!x));
    const done = new Set(mine.filter((p) => p.completed_at).map((p) => p.lesson_id));
    const inProgress = [...started].some((cid) => (lessonsByCourse.get(cid) ?? []).some((l) => !done.has(l)));
    const course = inProgress ? { completedLessonInWindow: mine.some((p) => p.completed_at && within(p.completed_at, memberWindow)) } : null;

    const result = scoreMember(
      {
        meetings: myMeetings,
        servesInServingWindow: serves.filter((s) => s.profile_id === pid && within(`${s.served_at}T12:00:00Z`, c("individual.serving_window_days"))).length,
        gatherings: gatheringsInput,
        activity: activityOf.get(pid) ?? [],
        course,
      },
      config,
      now,
    );

    const placement = currentGroup.get(pid);
    const isNew = !!placement && now.getTime() - t(placement.joined_at) < c("individual.new_member_days") * DAY;
    const paused = flagged.has(pid);
    const prior = historyOf(pid).map((h) => Number(h.total));
    const tier = memberTier(result.total, config, isNew);
    return {
      ministry_id: ministryId,
      profile_id: pid,
      as_of: asOf,
      total: result.total,
      tier,
      components: result.components,
      trend: trendOf(result.total, prior[0], config),
      velocity_alert: !isNew && !paused && velocityAlert(result.total, prior, config),
      is_new: isNew,
      paused,
    };
  });

  const up = await db.from("member_scores").upsert(memberRows, { onConflict: "ministry_id,profile_id,as_of" });
  if (up.error) throw new Error(`member_scores: ${up.error.message}`);
  const tierOf = new Map(memberRows.map((r) => [r.profile_id, r.tier as MemberTier]));
  const rowOf = new Map(memberRows.map((r) => [r.profile_id, r]));

  // ---------- Leaders ----------
  const leaderWindow = c("leader.window_days");
  const roleOf = new Map(members.map((m) => [m.profile_id, m.role]));
  const leaders = placements.filter((p) => !p.left_at && p.is_group_leader && roleOf.get(p.profile_id) && roleOf.get(p.profile_id) !== "member");
  const rosterOf = (groupId: string) => placements.filter((p) => p.group_id === groupId && !p.left_at).map((p) => p.profile_id);
  const leadersOf = (groupId: string) => new Set(leaders.filter((l) => l.group_id === groupId).map((l) => l.profile_id));
  const contactedBy = (men: string[], by: Set<string>, fromMs: number, toMs: number) =>
    new Set(contacts.filter((x) => men.includes(x.profile_id) && by.has(x.leader_id) && t(x.contacted_at) > fromMs && t(x.contacted_at) <= toMs)
      .map((x) => x.profile_id));

  const leaderRows = leaders.map((l) => {
    const roster = rosterOf(l.group_id).filter((pid) => pid !== l.profile_id);
    const groupLeaders = leadersOf(l.group_id);
    const covered = contactedBy(roster, groupLeaders, now.getTime() - c("leader.coverage_days") * DAY, now.getTime());

    // Needs a Call follow-through: men flagged (Disconnected or velocity) in the
    // window whose follow-through period has already passed.
    const followDays = c("leader.followthrough_days");
    const due = history.filter((h) => roster.includes(h.profile_id) && !h.is_new && !h.paused
      && (h.tier === "Disconnected" || h.velocity_alert)
      && within(`${h.as_of}T23:00:00Z`, leaderWindow) && t(`${h.as_of}T23:00:00Z`) + followDays * DAY <= now.getTime());
    const followed = due.filter((h) => {
      const start = t(`${h.as_of}T23:00:00Z`);
      return contactedBy([h.profile_id], groupLeaders, start, start + followDays * DAY).size > 0;
    });

    const expected = meetings.filter((m) => m.group_id === l.group_id && within(m.meeting_at, leaderWindow));
    const result = scoreLeader(
      {
        rosterSize: roster.length,
        contactedInCoverageWindow: covered.size,
        flagged: due.length,
        followedUpInTime: followed.length,
        meetingsExpected: expected.length,
        meetingsHeld: expected.filter(isHeld).length,
        personalTier: tierOf.get(l.profile_id) ?? null,
      },
      config,
    );
    return {
      ministry_id: ministryId,
      profile_id: l.profile_id,
      group_id: l.group_id,
      as_of: asOf,
      total: result.total,
      tier: leaderTier(result.total, config),
      components: result.components,
    };
  });
  if (leaderRows.length) {
    const lu = await db.from("leader_scores").upsert(leaderRows, { onConflict: "ministry_id,profile_id,as_of" });
    if (lu.error) throw new Error(`leader_scores: ${lu.error.message}`);
  }

  // ---------- Groups ----------
  const groupWindow = c("group.window_days");
  const activeGroups = groups.filter((g) => g.status === "active");
  const groupRows = activeGroups.map((g) => {
    const roster = rosterOf(g.id);
    const expected = meetings.filter((m) => m.group_id === g.id && within(m.meeting_at, groupWindow));
    const held = expected.filter(isHeld).sort((a, b) => t(b.meeting_at) - t(a.meeting_at));
    const marks = attendance.filter((a) => held.some((m) => m.id === a.meeting_id));

    const weeks = Math.max(1, Math.floor(groupWindow / 7));
    const weeklyActiveShare = roster.length
      ? Array.from({ length: weeks }, (_, w) => {
          const to = now.getTime() - w * 7 * DAY;
          const from = to - 7 * DAY;
          const active = roster.filter((pid) => (activityOf.get(pid) ?? []).some((d) => d.getTime() > from && d.getTime() <= to));
          return active.length / roster.length;
        })
      : [];

    // Unexplained departure: left this group in the window and is not in another group now.
    const departures = placements.filter((p) => p.group_id === g.id && p.left_at && within(p.left_at, groupWindow) && !currentGroup.has(p.profile_id)).length;

    const result = scoreGroup(
      {
        memberTotals: roster.map((pid) => rowOf.get(pid)).filter((r) => r && !r.is_new && !r.paused).map((r) => Number(r!.total)),
        presents: marks.filter((m) => m.status === "present").length,
        attendanceMarks: marks.length,
        meetingsExpected: expected.length,
        meetingsHeld: held.length,
        weeklyActiveShare,
        rosterSize: roster.length,
        unexplainedDepartures: departures,
      },
      config,
    );

    // Automatic at-risk triggers (override the score).
    const triggers: string[] = [];
    const noMeetingDays = c("group.trigger.no_meeting_days");
    if (expected.length && !held.some((m) => within(m.meeting_at, noMeetingDays))) triggers.push(`No meeting held in ${noMeetingDays} days`);
    const lowN = c("group.trigger.low_attendance_meetings");
    const lastN = held.slice(0, lowN);
    const rate = (m: (typeof held)[number]) => {
      const rows = attendance.filter((a) => a.meeting_id === m.id);
      return rows.length ? (100 * rows.filter((a) => a.status === "present").length) / rows.length : 100;
    };
    if (lastN.length === lowN && lastN.every((m) => rate(m) < c("group.trigger.low_attendance_pct"))) {
      triggers.push(`Attendance below ${c("group.trigger.low_attendance_pct")} percent for ${lowN} meetings in a row`);
    }
    const quietDays = c("group.trigger.quiet_days");
    if (roster.length && !roster.some((pid) => (activityOf.get(pid) ?? []).some((d) => within(d.toISOString(), quietDays)))) {
      triggers.push(`No group activity in ${quietDays} days`);
    }
    if (leaderRows.some((l) => l.group_id === g.id && l.tier === "Inactive")) triggers.push("Leader is Inactive");

    return {
      ministry_id: ministryId,
      group_id: g.id,
      as_of: asOf,
      total: result.total,
      band: groupBand(result.total, triggers, config),
      components: result.components,
      triggers,
    };
  });
  if (groupRows.length) {
    const gu = await db.from("group_scores").upsert(groupRows, { onConflict: "ministry_id,group_id,as_of" });
    if (gu.error) throw new Error(`group_scores: ${gu.error.message}`);
  }

  return { ministryId, members: memberRows.length, leaders: leaderRows.length, groups: groupRows.length, asOf };
}
