import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DbEnum } from "@manup/shared";

type Db = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["push_outbox"]["Insert"];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ministry_config push_schedule (0014). Days are ISO weekdays (1 = Monday); hours are
// local to the ministry's time zone.
type Schedule = {
  meeting_reminder_hours: number;
  attendance_prompt_hours: number;
  checkin_day: number; checkin_hour: number;
  digest_day: number; digest_hour: number;
  questions_day: number; questions_hour: number;
};
const SCHEDULE_KEYS: (keyof Schedule)[] = [
  "meeting_reminder_hours", "attendance_prompt_hours", "checkin_day", "checkin_hour",
  "digest_day", "digest_hour", "questions_day", "questions_hour",
];

function parseSchedule(value: unknown): Schedule | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  return SCHEDULE_KEYS.every((k) => typeof v[k] === "number") ? (v as Schedule) : null;
}

// Local date, ISO weekday, and hour in the ministry's time zone.
function localNow(now: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" })
      .formatToParts(now).map((p) => [p.type, p.value]),
  );
  const isoDow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday!) + 1;
  const [y, m, d] = [Number(parts.year), Number(parts.month), Number(parts.day)];
  const weekOf = new Date(Date.UTC(y, m - 1, d - (isoDow - 1))).toISOString().slice(0, 10);
  return { isoDow, hour: Number(parts.hour) % 24, weekOf };
}

const timeIn = (iso: string, timeZone: string) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export type ScheduleSummary = { ministryId: string; skipped?: string; queued: Partial<Record<DbEnum<"push_kind">, number>> };

// Queues whatever scheduled pushes are due for one ministry. Safe to run as often as
// you like: every row has a dedupe key (per meeting, per week, per question set), so
// a man gets each push once.
export async function queueScheduled(db: Db, ministryId: string, now = new Date()): Promise<ScheduleSummary> {
  const summary: ScheduleSummary = { ministryId, queued: {} };
  const { data: config, error } = await db.from("ministry_config").select("key, value")
    .eq("ministry_id", ministryId).in("key", ["push_schedule", "timezone"]);
  if (error) throw new Error(error.message);
  const schedule = parseSchedule(config?.find((c) => c.key === "push_schedule")?.value);
  if (!schedule) return { ...summary, skipped: "no push_schedule in ministry_config" };
  const timeZone = String(config?.find((c) => c.key === "timezone")?.value ?? "UTC");
  const local = localNow(now, timeZone);

  const [groups, placements, members, meetings] = await Promise.all([
    db.from("groups").select("id, name").eq("ministry_id", ministryId).eq("status", "active"),
    db.from("group_members").select("group_id, profile_id, is_group_leader").eq("ministry_id", ministryId).is("left_at", null),
    db.from("ministry_members").select("profile_id, role").eq("ministry_id", ministryId).is("left_at", null),
    db.from("meetings").select("id, group_id, meeting_at, attendance_marked_at").eq("ministry_id", ministryId)
      .gt("meeting_at", new Date(now.getTime() - DAY).toISOString())
      .lte("meeting_at", new Date(now.getTime() + schedule.meeting_reminder_hours * HOUR).toISOString()),
  ]);
  for (const r of [groups, placements, members, meetings]) if (r.error) throw new Error(r.error.message);

  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const roleOf = new Map((members.data ?? []).map((m) => [m.profile_id, m.role]));
  // Current men of active groups who are still in the ministry.
  const inGroups = (placements.data ?? []).filter((p) => groupName.has(p.group_id) && roleOf.has(p.profile_id));
  const menOf = (groupId: string) => inGroups.filter((p) => p.group_id === groupId).map((p) => p.profile_id);
  // Same rule as fn_leads_group: flagged as a group leader and not a plain member.
  const leaders = inGroups.filter((p) => p.is_group_leader && roleOf.get(p.profile_id) !== "member");

  const rows: Row[] = [];
  const queue = (kind: DbEnum<"push_kind">, profileIds: string[], dedupeKey: string, title: string, body: string, refId: string | null) => {
    for (const profile_id of profileIds) rows.push({ ministry_id: ministryId, profile_id, kind, ref_id: refId, dedupe_key: dedupeKey, title, body });
    summary.queued[kind] = (summary.queued[kind] ?? 0) + profileIds.length;
  };

  // Meeting reminder: once the meeting is within meeting_reminder_hours.
  for (const m of meetings.data ?? []) {
    const name = groupName.get(m.group_id);
    if (!name || new Date(m.meeting_at) <= now) continue;
    queue("meeting_reminder", menOf(m.group_id), `meeting_reminder:${m.id}`, name,
      `Your group meets today at ${timeIn(m.meeting_at, timeZone)}.`, m.id);
  }

  // Attendance prompt: attendance_prompt_hours after the meeting, if still unmarked
  // (the meeting only counts if marked within 72 hours).
  for (const m of meetings.data ?? []) {
    const name = groupName.get(m.group_id);
    if (!name || m.attendance_marked_at || new Date(m.meeting_at).getTime() + schedule.attendance_prompt_hours * HOUR > now.getTime()) continue;
    queue("attendance_prompt", leaders.filter((l) => l.group_id === m.group_id).map((l) => l.profile_id),
      `attendance_prompt:${m.id}`, "Mark attendance", `Who was at ${name} today? It takes a minute.`, m.id);
  }

  // Weekly check-in prompt, to men in a group who have not checked in this week.
  if (local.isoDow === schedule.checkin_day && local.hour >= schedule.checkin_hour) {
    const { data: done, error: e } = await db.from("weekly_checkins").select("profile_id")
      .eq("ministry_id", ministryId).eq("week_of", local.weekOf);
    if (e) throw new Error(e.message);
    const checkedIn = new Set((done ?? []).map((d) => d.profile_id));
    queue("checkin_prompt", [...new Set(inGroups.map((p) => p.profile_id))].filter((id) => !checkedIn.has(id)),
      `checkin:${local.weekOf}`, "How are you really doing?", "Tap 1 (rough week) to 5 (strong week). Only your group sees it.", null);
  }

  // This week's discussion questions, once published for this week.
  if (local.isoDow === schedule.questions_day && local.hour >= schedule.questions_hour) {
    const { data: sets, error: e } = await db.from("weekly_questions").select("id, title")
      .eq("ministry_id", ministryId).eq("week_of", local.weekOf).eq("is_published", true).limit(1);
    if (e) throw new Error(e.message);
    const set = sets?.[0];
    if (set) {
      queue("weekly_questions", [...new Set(inGroups.map((p) => p.profile_id))], `weekly_questions:${set.id}`,
        "This week's questions", set.title ? `${set.title}: ready for your group.` : "New discussion questions are ready for your group.", set.id);
    }
  }

  // Monday digest for each leader: counts only, from the latest scores and contact logs.
  if (local.isoDow === schedule.digest_day && local.hour >= schedule.digest_hour && leaders.length) {
    const [scores, contacts] = await Promise.all([
      db.from("member_scores").select("profile_id, as_of, tier, velocity_alert, is_new, paused").eq("ministry_id", ministryId)
        .gte("as_of", new Date(now.getTime() - 8 * DAY).toISOString().slice(0, 10)).order("as_of", { ascending: false }),
      db.from("contact_logs").select("profile_id, leader_id").eq("ministry_id", ministryId)
        .gte("contacted_at", new Date(now.getTime() - 30 * DAY).toISOString()),
    ]);
    for (const r of [scores, contacts]) if (r.error) throw new Error(r.error.message);
    const latest = new Map<string, NonNullable<typeof scores.data>[number]>();
    for (const s of scores.data ?? []) if (!latest.has(s.profile_id)) latest.set(s.profile_id, s);

    for (const l of leaders) {
      const groupLeaders = new Set(leaders.filter((x) => x.group_id === l.group_id).map((x) => x.profile_id));
      const men = menOf(l.group_id).filter((id) => !groupLeaders.has(id));
      if (!men.length) continue;
      const worth = men.filter((id) => {
        const s = latest.get(id);
        return s && !s.is_new && !s.paused && (s.tier === "Drifting" || s.tier === "Disconnected" || s.velocity_alert);
      }).length;
      const contacted = new Set((contacts.data ?? []).filter((c) => c.leader_id && groupLeaders.has(c.leader_id)).map((c) => c.profile_id));
      const notContacted = men.filter((id) => !contacted.has(id)).length;
      const body = worth || notContacted
        ? [worth ? `${plural(worth, "man", "men")} worth a check-in` : null, notContacted ? `${plural(notContacted, "man", "men")} not yet contacted this month` : null]
            .filter(Boolean).join(", ") + "."
        : "Every man is connected and contacted this month.";
      queue("leader_digest", [l.profile_id], `digest:${local.weekOf}`, "Your week with your men", body, l.group_id);
    }
  }

  for (let i = 0; i < rows.length; i += 500) {
    const { error: e } = await db.from("push_outbox")
      .upsert(rows.slice(i, i + 500), { onConflict: "profile_id,dedupe_key", ignoreDuplicates: true });
    if (e) throw new Error(`push_outbox: ${e.message}`);
  }
  return summary;
}
