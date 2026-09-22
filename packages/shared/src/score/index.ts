// Scoring math (docs/scoring-plan.md v1.1). Pure functions: every weight, window,
// and threshold comes from the ministry's score_config rows, passed in as `config`.
// Inputs are counts and timestamps of activity only; no content ever reaches here.

export type ScoreConfig = Record<string, number>;

export type Component = { earned: number; max: number; applicable: boolean };
export type ScoreResult = { total: number; components: Record<string, Component> };

const DAY = 86_400_000;

function cfg(config: ScoreConfig, key: string): number {
  const v = config[key];
  if (v === undefined || Number.isNaN(v)) throw new Error(`score_config is missing "${key}"`);
  return v;
}

// Components that do not apply (no data source, not enrolled, not matched to PCO)
// drop out and their points redistribute proportionally (scoring plan section 3).
export function combine(components: Record<string, Component>): ScoreResult {
  const applicable = Object.values(components).filter((c) => c.applicable);
  const max = applicable.reduce((s, c) => s + c.max, 0);
  const earned = applicable.reduce((s, c) => s + c.earned, 0);
  return { total: max > 0 ? Math.round((earned / max) * 1000) / 10 : 0, components };
}

const na = (max: number): Component => ({ earned: 0, max, applicable: false });

// Recency weighting inside the window: the most recent quarter of the window weighs
// 4, then 3, 2, 1 (normalized). Returns null outside the window.
export function recencyWeight(at: Date, periodEnd: Date, windowDays: number): number | null {
  const age = periodEnd.getTime() - at.getTime();
  if (age < 0 || age > windowDays * DAY) return null;
  const bucket = Math.min(3, Math.floor(age / ((windowDays * DAY) / 4)));
  return 4 - bucket;
}

// ---------- Individual engagement ----------

export type MemberInputs = {
  // Held meetings of the groups he was in at the time (held = marked within the gate).
  meetings: { meetingAt: Date; status: "present" | "excused" | "absent" | null }[];
  servesInServingWindow: number;
  // null when gatherings cannot count for him (not matched to PCO, or no check-in
  // source configured, or no gatherings held in the window).
  gatherings: { held: number; attended: number } | null;
  // Timestamps of his group activity (messages, prayer requests, "I prayed", comments).
  activity: Date[];
  // null when he is not enrolled in an unfinished course.
  course: { completedLessonInWindow: boolean } | null;
  // null when he cannot check in (not in a group). `weeks` are the weeks he checked
  // in (any day inside each week); `eligibleFrom` is when he could first check in
  // (the later of his group join and the ministry's first check-in), so weeks before
  // the feature or before he joined never count against him.
  checkin: { weeks: Date[]; eligibleFrom: Date } | null;
};

export function scoreMember(input: MemberInputs, config: ScoreConfig, periodEnd: Date): ScoreResult {
  const windowDays = cfg(config, "individual.window_days");

  // Group attendance: present = 1, excused = 0.5, absent/unmarked = 0, recency weighted.
  const aMax = cfg(config, "individual.attendance");
  let aW = 0;
  let aCredit = 0;
  for (const m of input.meetings) {
    const w = recencyWeight(m.meetingAt, periodEnd, windowDays);
    if (w === null) continue;
    aW += w;
    aCredit += w * (m.status === "present" ? 1 : m.status === "excused" ? 0.5 : 0);
  }
  const attendance: Component = aW > 0 ? { earned: (aMax * aCredit) / aW, max: aMax, applicable: true } : na(aMax);

  // Serving: one confirmed serve in the serving window earns serving_one, two or more full.
  const sMax = cfg(config, "individual.serving");
  const serving: Component = {
    earned: input.servesInServingWindow >= 2 ? sMax : input.servesInServingWindow === 1 ? cfg(config, "individual.serving_one") : 0,
    max: sMax,
    applicable: true,
  };

  // Weekly check-in: that he checked in, recency weighted per week, over the weeks
  // he could have. The 1 to 5 value never reaches here (scoring plan section 3).
  const kMax = cfg(config, "individual.checkin");
  let checkin = na(kMax);
  if (input.checkin) {
    const bucketDays = windowDays / 4;
    // Bucket with weight w covers ages [(4 - w) * q, (5 - w) * q); it is eligible when
    // its newest moment is after eligibleFrom.
    const eligible = [4, 3, 2, 1].filter((w) => periodEnd.getTime() - (4 - w) * bucketDays * DAY > input.checkin!.eligibleFrom.getTime());
    if (eligible.length) {
      const done = new Set<number>();
      for (const at of input.checkin.weeks) {
        const w = recencyWeight(at, periodEnd, windowDays);
        if (w !== null && eligible.includes(w)) done.add(w);
      }
      const sum = (ws: Iterable<number>) => [...ws].reduce((s, w) => s + w, 0);
      checkin = { earned: (kMax * sum(done)) / sum(eligible), max: kMax, applicable: true };
    }
  }

  const gMax = cfg(config, "individual.gathering");
  const gathering: Component =
    input.gatherings && input.gatherings.held > 0
      ? { earned: gMax * Math.min(1, input.gatherings.attended / input.gatherings.held), max: gMax, applicable: true }
      : na(gMax);

  // Participation: binary per recency bucket (a week, for a 28 to 30 day window).
  const pMax = cfg(config, "individual.participation");
  const activeBuckets = new Set<number>();
  for (const at of input.activity) {
    const w = recencyWeight(at, periodEnd, windowDays);
    if (w !== null) activeBuckets.add(w);
  }
  const pEarned = (pMax * [...activeBuckets].reduce((s, w) => s + w, 0)) / (4 + 3 + 2 + 1);
  const participation: Component = { earned: pEarned, max: pMax, applicable: true };

  const cMax = cfg(config, "individual.course");
  const course: Component = input.course
    ? { earned: input.course.completedLessonInWindow ? cMax : 0, max: cMax, applicable: true }
    : na(cMax);

  return combine({ attendance, serving, checkin, gathering, participation, course });
}

export type MemberTier = "New" | "Thriving" | "Steady" | "Drifting" | "Disconnected";

export function memberTier(total: number, config: ScoreConfig, isNew: boolean): MemberTier {
  if (isNew) return "New";
  if (total >= cfg(config, "individual.tier.thriving")) return "Thriving";
  if (total >= cfg(config, "individual.tier.steady")) return "Steady";
  if (total >= cfg(config, "individual.tier.drifting")) return "Drifting";
  return "Disconnected";
}

export function trendOf(current: number, previous: number | undefined, config: ScoreConfig): "up" | "flat" | "down" {
  if (previous === undefined) return "flat";
  const delta = cfg(config, "individual.trend_delta");
  if (current >= previous + delta) return "up";
  if (current <= previous - delta) return "down";
  return "flat";
}

// Velocity alert: N consecutive weekly declines (history newest first, excluding current).
export function velocityAlert(current: number, history: number[], config: ScoreConfig): boolean {
  const weeks = cfg(config, "individual.velocity_weeks");
  const series = [current, ...history];
  if (series.length < weeks + 1) return false;
  for (let i = 0; i < weeks; i++) {
    const newer = series[i];
    const older = series[i + 1];
    if (newer === undefined || older === undefined || !(newer < older)) return false;
  }
  return true;
}

// ---------- Leader (shepherding consistency) ----------

export type LeaderInputs = {
  rosterSize: number; // his men, excluding himself
  contactedInCoverageWindow: number; // of those, men with a logged contact
  flagged: number; // men who landed on Needs a Call in the window (and are due)
  followedUpInTime: number; // of those, contacted within the follow-through days
  meetingsExpected: number;
  meetingsHeld: number; // marked within the gate
  personalTier: MemberTier | null;
};

export function scoreLeader(input: LeaderInputs, config: ScoreConfig): ScoreResult {
  const covMax = cfg(config, "leader.coverage");
  const ftMax = cfg(config, "leader.followthrough");
  const mMax = cfg(config, "leader.meetings");
  const pMax = cfg(config, "leader.personal");
  return combine({
    coverage: input.rosterSize > 0 ? { earned: (covMax * input.contactedInCoverageWindow) / input.rosterSize, max: covMax, applicable: true } : na(covMax),
    followthrough: input.flagged > 0 ? { earned: (ftMax * input.followedUpInTime) / input.flagged, max: ftMax, applicable: true } : na(ftMax),
    meetings: input.meetingsExpected > 0 ? { earned: (mMax * Math.min(input.meetingsHeld, input.meetingsExpected)) / input.meetingsExpected, max: mMax, applicable: true } : na(mMax),
    personal: {
      earned: input.personalTier && ["New", "Thriving", "Steady"].includes(input.personalTier) ? pMax : 0,
      max: pMax,
      applicable: input.personalTier !== null,
    },
  });
}

export function leaderTier(total: number, config: ScoreConfig): "Consistent" | "Inconsistent" | "Inactive" {
  if (total >= cfg(config, "leader.tier.consistent")) return "Consistent";
  if (total >= cfg(config, "leader.tier.inconsistent")) return "Inconsistent";
  return "Inactive";
}

// ---------- Group health ----------

export type GroupInputs = {
  memberTotals: number[]; // excludes New and season-flagged men
  presents: number;
  attendanceMarks: number; // present + excused + absent rows on held meetings
  meetingsExpected: number;
  meetingsHeld: number;
  weeklyActiveShare: number[]; // per week: share of roster active (0..1)
  rosterSize: number;
  unexplainedDepartures: number;
};

export function scoreGroup(input: GroupInputs, config: ScoreConfig): ScoreResult {
  const eMax = cfg(config, "group.engagement");
  const aMax = cfg(config, "group.attendance");
  const mMax = cfg(config, "group.meetings");
  const sMax = cfg(config, "group.spread");
  const stMax = cfg(config, "group.stability");
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return combine({
    engagement: input.memberTotals.length ? { earned: (eMax * mean(input.memberTotals)) / 100, max: eMax, applicable: true } : na(eMax),
    attendance: input.attendanceMarks > 0 ? { earned: (aMax * input.presents) / input.attendanceMarks, max: aMax, applicable: true } : na(aMax),
    meetings: input.meetingsExpected > 0 ? { earned: (mMax * Math.min(input.meetingsHeld, input.meetingsExpected)) / input.meetingsExpected, max: mMax, applicable: true } : na(mMax),
    spread: input.weeklyActiveShare.length ? { earned: sMax * mean(input.weeklyActiveShare), max: sMax, applicable: true } : na(sMax),
    stability: input.rosterSize > 0
      ? { earned: stMax * Math.max(0, 1 - input.unexplainedDepartures / input.rosterSize), max: stMax, applicable: true }
      : na(stMax),
  });
}

export function groupBand(total: number, triggers: string[], config: ScoreConfig): "Healthy" | "Watch" | "At Risk" {
  if (triggers.length) return "At Risk";
  if (total >= cfg(config, "group.band.healthy")) return "Healthy";
  if (total >= cfg(config, "group.band.watch")) return "Watch";
  return "At Risk";
}
