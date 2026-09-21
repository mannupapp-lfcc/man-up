import assert from "node:assert/strict";
import { test } from "node:test";
import {
  groupBand,
  leaderTier,
  memberTier,
  recencyWeight,
  scoreGroup,
  scoreLeader,
  scoreMember,
  trendOf,
  velocityAlert,
  type ScoreConfig,
} from "./index";

// The v1.1 defaults seeded by 0010_scoring.sql.
const config: ScoreConfig = {
  "individual.attendance": 30, "individual.serving": 20, "individual.serving_one": 15, "individual.checkin": 15,
  "individual.gathering": 15, "individual.participation": 10, "individual.course": 10,
  "individual.window_days": 30, "individual.serving_window_days": 90,
  "individual.tier.thriving": 80, "individual.tier.steady": 55, "individual.tier.drifting": 30,
  "individual.new_member_days": 30, "individual.velocity_weeks": 3, "individual.trend_delta": 3,
  "leader.coverage": 35, "leader.followthrough": 25, "leader.meetings": 25, "leader.personal": 15,
  "leader.tier.consistent": 75, "leader.tier.inconsistent": 45,
  "group.engagement": 40, "group.attendance": 20, "group.meetings": 15, "group.spread": 15, "group.stability": 10,
  "group.band.healthy": 75, "group.band.watch": 50,
};

const end = new Date("2026-07-31T23:00:00Z");
const daysAgo = (d: number) => new Date(end.getTime() - d * 86_400_000);

test("recency weights: newest quarter counts 4, oldest 1, outside is null", () => {
  assert.equal(recencyWeight(daysAgo(1), end, 30), 4);
  assert.equal(recencyWeight(daysAgo(10), end, 30), 3);
  assert.equal(recencyWeight(daysAgo(20), end, 30), 2);
  assert.equal(recencyWeight(daysAgo(29), end, 30), 1);
  assert.equal(recencyWeight(daysAgo(31), end, 30), null);
});

test("worked example (scoring plan section 11): Marcus lands Thriving", () => {
  const r = scoreMember(
    {
      // 3 of 4 meetings, including the two most recent.
      meetings: [
        { meetingAt: daysAgo(3), status: "present" },
        { meetingAt: daysAgo(10), status: "present" },
        { meetingAt: daysAgo(17), status: "absent" },
        { meetingAt: daysAgo(24), status: "present" },
      ],
      servesInServingWindow: 1,
      gatherings: { held: 1, attended: 1 },
      activity: [daysAgo(2), daysAgo(9)], // "I prayed" twice, in the two most recent weeks
      course: null, // not enrolled: course points redistribute
    },
    config,
    end,
  );
  assert.equal(r.components.checkin?.applicable, false, "check-in has no source yet and redistributes");
  assert.equal(r.components.course?.applicable, false);
  assert.ok(Math.abs((r.components.attendance?.earned ?? 0) - 24) < 0.01, "about 25 of 30 (plan), 24 exactly");
  assert.equal(r.components.serving?.earned, 15);
  assert.equal(r.components.gathering?.earned, 15);
  assert.equal(r.components.participation?.earned, 7, "about 7 of 10");
  assert.ok(r.total >= 80, `total ${r.total} should be Thriving`);
  assert.equal(memberTier(r.total, config, false), "Thriving");
});

test("recent silence scores lower than recent momentum with the same counts", () => {
  const early = scoreMember(
    { meetings: [{ meetingAt: daysAgo(24), status: "present" }, { meetingAt: daysAgo(3), status: "absent" }],
      servesInServingWindow: 0, gatherings: null, activity: [], course: null }, config, end);
  const recent = scoreMember(
    { meetings: [{ meetingAt: daysAgo(24), status: "absent" }, { meetingAt: daysAgo(3), status: "present" }],
      servesInServingWindow: 0, gatherings: null, activity: [], course: null }, config, end);
  assert.ok(recent.total > early.total);
});

test("excused counts half; nothing held means attendance does not apply", () => {
  const r = scoreMember({ meetings: [{ meetingAt: daysAgo(3), status: "excused" }], servesInServingWindow: 2,
    gatherings: null, activity: [], course: null }, config, end);
  assert.equal(r.components.attendance?.earned, 15);
  const none = scoreMember({ meetings: [], servesInServingWindow: 0, gatherings: null, activity: [], course: null }, config, end);
  assert.equal(none.components.attendance?.applicable, false);
});

test("tiers, New grace, trend, velocity", () => {
  assert.equal(memberTier(79.9, config, false), "Steady");
  assert.equal(memberTier(30, config, false), "Drifting");
  assert.equal(memberTier(29.9, config, false), "Disconnected");
  assert.equal(memberTier(10, config, true), "New");
  assert.equal(trendOf(70, 65, config), "up");
  assert.equal(trendOf(70, 71, config), "flat");
  assert.equal(trendOf(60, 70, config), "down");
  assert.equal(velocityAlert(60, [65, 70, 75], config), true, "three straight declines");
  assert.equal(velocityAlert(60, [65, 70, 68], config), false);
  assert.equal(velocityAlert(60, [65, 70], config), false, "not enough history");
});

test("leader score: coverage, follow-through, cadence, own engagement", () => {
  const r = scoreLeader({ rosterSize: 6, contactedInCoverageWindow: 6, flagged: 0, followedUpInTime: 0,
    meetingsExpected: 8, meetingsHeld: 8, personalTier: "Steady" }, config);
  assert.equal(r.components.followthrough?.applicable, false, "no one flagged: redistributes");
  assert.equal(r.total, 100);
  assert.equal(leaderTier(r.total, config), "Consistent");
  const weak = scoreLeader({ rosterSize: 6, contactedInCoverageWindow: 1, flagged: 2, followedUpInTime: 0,
    meetingsExpected: 8, meetingsHeld: 3, personalTier: "Drifting" }, config);
  assert.equal(leaderTier(weak.total, config), "Inactive");
});

test("group health: bands and trigger override", () => {
  const r = scoreGroup({ memberTotals: [80, 70, 90], presents: 18, attendanceMarks: 20, meetingsExpected: 8, meetingsHeld: 8,
    weeklyActiveShare: [0.8, 0.6, 1, 0.8], rosterSize: 5, unexplainedDepartures: 0 }, config);
  assert.equal(groupBand(r.total, [], config), "Healthy");
  assert.equal(groupBand(r.total, ["No meeting held in 21 days"], config), "At Risk");
});

test("a missing weight is an error, never a silent default", () => {
  assert.throws(() => scoreMember({ meetings: [], servesInServingWindow: 0, gatherings: null, activity: [], course: null },
    { ...config, "individual.attendance": Number.NaN }, end), /individual.attendance/);
});
