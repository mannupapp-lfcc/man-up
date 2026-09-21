import { createServiceClient } from "@/lib/supabase/service";
import { syncMinistry } from "@/lib/pco/sync";
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

export const functions = [nightlyPcoSync, nightlyMeetings];
