import { createServiceClient } from "@/lib/supabase/service";
import { syncMinistry } from "@/lib/pco/sync";
import { scoreMinistry } from "@/lib/scoring/run";
import { drainOutbox, pruneOutbox } from "@/lib/push/send";
import { queueScheduled } from "@/lib/push/schedule";
import { inngest } from "./client";

// Sent by the push_outbox trigger (0018) with no data; the name must match it.
const PUSH_QUEUED = "push/outbox.queued";

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
// Schedules are whole hours, so hourly is enough; each row has a dedupe key, so a
// rerun never double-queues. Rows it queues wake the sender (0018).
export const pushScheduler = inngest.createFunction(
  { id: "push-scheduler", triggers: [{ cron: "0 * * * *" }] },
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
    // Backstop for a missed wake-up (Vault key not set yet, or the call failed):
    // anything still unsent gets the sender going.
    const unsent = await step.run("count-unsent", async () => {
      const { count, error } = await createServiceClient()
        .from("push_outbox").select("id", { count: "exact", head: true }).is("sent_at", null);
      if (error) throw new Error(error.message);
      return count ?? 0;
    });
    if (unsent > 0) await step.sendEvent("wake-sender", { name: PUSH_QUEUED, data: {} });
    return results;
  },
);

// Sends whatever is in the push outbox. No polling: an insert into push_outbox sends
// "push/outbox.queued" (0018), debounced so a burst of chat is one run (and a steady
// stream still sends at least once a minute). One run at a time, so two runs never
// pick up the same rows.
export const pushSender = inngest.createFunction(
  {
    id: "push-sender",
    concurrency: { limit: 1 },
    debounce: { period: "5s", timeout: "1m" },
    triggers: [{ event: PUSH_QUEUED }],
  },
  async ({ step }) => step.run("drain", () => drainOutbox(createServiceClient())),
);

export const functions = [nightlyPcoSync, nightlyMeetings, weeklyScoring, pushScheduler, pushSender];
