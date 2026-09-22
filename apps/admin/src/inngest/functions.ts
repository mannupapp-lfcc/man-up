import { createServiceClient } from "@/lib/supabase/service";
import { syncMinistry } from "@/lib/pco/sync";
import { scoreMinistry } from "@/lib/scoring/run";
import { drainOutbox, pruneOutbox } from "@/lib/push/send";
import { queueScheduled } from "@/lib/push/schedule";
import { inngest } from "./client";

// Nightly one-way PCO read sync (roster, events, check-ins), one step per ministry
// so a failure in one ministry never blocks another.
export const nightlyPcoSync = inngest.createFunction(
  { id: "nightly-pco-sync", triggers: [{ cron: "TZ=America/New_York 0 2 * * *" }] },
  async ({ step }) => {
    const ministryIds = await step.run("list-ministries", async () => {
      const db = createServiceClient();
      const { data } = await db.from("ministry_config").select("ministry_id").eq("key", "pco_group_id");
      return (data ?? []).map((r) => r.ministry_id);
    });
    const results = [];
    for (const id of ministryIds) {
      results.push(await step.run(`sync-${id}`, () => syncMinistry(createServiceClient(), id)));
    }
    return results;
  },
);

// Generates the next 4 weeks of group meetings for every ministry, nightly.
export const nightlyMeetings = inngest.createFunction(
  { id: "nightly-generate-meetings", triggers: [{ cron: "TZ=America/New_York 30 2 * * *" }] },
  async ({ step }) => {
    const ministryIds = await step.run("list-ministries", async () => {
      const db = createServiceClient();
      const { data } = await db.from("ministries").select("id").eq("status", "active");
      return (data ?? []).map((r) => r.id);
    });
    for (const id of ministryIds) {
      await step.run(`meetings-${id}`, async () => {
        const { data, error } = await createServiceClient().rpc("generate_meetings", { p_ministry: id });
        if (error) throw new Error(error.message);
        return data;
      });
    }
  },
);

// Sunday night scoring (docs/scoring-plan.md): every ministry against its own
// score_config. Runs after the nightly PCO sync has pulled Saturday check-ins.
export const weeklyScoring = inngest.createFunction(
  { id: "weekly-scoring", triggers: [{ cron: "TZ=America/New_York 0 23 * * 0" }] },
  async ({ step }) => {
    const ministryIds = await step.run("list-ministries", async () => {
      const { data } = await createServiceClient().from("score_config").select("ministry_id");
      return [...new Set((data ?? []).map((r) => r.ministry_id))];
    });
    const results = [];
    for (const id of ministryIds) {
      results.push(await step.run(`score-${id}`, () => scoreMinistry(createServiceClient(), id)));
    }
    return results;
  },
);

// Scheduled pushes (meeting reminders, attendance prompts, weekly check-in, weekly
// questions, Monday leader digests): queued per ministry from its push_schedule.
// Each row has a dedupe key, so running every 15 minutes never double-queues.
export const pushScheduler = inngest.createFunction(
  { id: "push-scheduler", triggers: [{ cron: "*/15 * * * *" }] },
  async ({ step }) => {
    const ministryIds = await step.run("list-ministries", async () => {
      const { data } = await createServiceClient().from("ministry_config").select("ministry_id").eq("key", "push_schedule");
      return (data ?? []).map((r) => r.ministry_id);
    });
    const results = [];
    for (const id of ministryIds) {
      results.push(await step.run(`queue-${id}`, () => queueScheduled(createServiceClient(), id)));
    }
    await step.run("prune", () => pruneOutbox(createServiceClient()));
    return results;
  },
);

// Sends whatever is in the push outbox (chat within a minute of posting). One run at
// a time, so two runs never pick up the same rows.
export const pushSender = inngest.createFunction(
  { id: "push-sender", concurrency: { limit: 1 }, triggers: [{ cron: "* * * * *" }] },
  async ({ step }) => step.run("drain", () => drainOutbox(createServiceClient())),
);

export const functions = [nightlyPcoSync, nightlyMeetings, weeklyScoring, pushScheduler, pushSender];
