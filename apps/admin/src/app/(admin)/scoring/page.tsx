import { Flash, PageTitle, Section, Submit, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { updateSetting } from "./actions";

const SECTION: Record<string, string> = { individual: "Member engagement", leader: "Leader consistency", group: "Group health", meeting: "Meetings" };

// Quarterly recalibration (scoring plan section 9): every change needs a reason and
// is logged. Weights are data, never code.
export default async function ScoringPage({ searchParams }: PageProps<"/scoring">) {
  const { error, notice } = await searchParams;
  const { supabase, ministryId, timeZone } = await requireAdmin();
  const [config, changes, people] = await Promise.all([
    supabase.from("score_config").select("key, value, updated_at").eq("ministry_id", ministryId).order("key"),
    supabase.from("score_config_changes").select("key, old_value, new_value, reason, changed_by, changed_at").eq("ministry_id", ministryId)
      .order("changed_at", { ascending: false }).limit(30),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const name = new Map((people.data ?? []).map((p) => [p.id, p.full_name]));
  const bySection = new Map<string, { key: string; value: number }[]>();
  for (const row of config.data ?? []) {
    const section = row.key.split(".")[0] ?? "other";
    bySection.set(section, [...(bySection.get(section) ?? []), { key: row.key, value: Number(row.value) }]);
  }

  return (
    <>
      <PageTitle sub="Weights, windows, and thresholds from the scoring plan. Change them at the quarterly calibration review, with a reason.">
        Scoring settings
      </PageTitle>
      <Flash error={error} notice={notice} />
      {[...bySection.entries()].map(([section, rows]) => (
        <Section key={section} title={SECTION[section] ?? section}>
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((r) => (
              <li key={r.key} className="py-2">
                <form action={updateSetting} className="flex flex-wrap items-center gap-2 text-sm">
                  <input type="hidden" name="key" value={r.key} />
                  <span className="w-72 font-mono">{r.key.replace(`${section}.`, "")}</span>
                  <input name="value" type="number" step="any" defaultValue={r.value} className={`${inputClass} w-24`} />
                  <input name="reason" placeholder="Reason for the change" required className={`${inputClass} min-w-56 flex-1`} />
                  <Submit variant="secondary">Save</Submit>
                </form>
              </li>
            ))}
          </ul>
        </Section>
      ))}
      <Section title="Change log">
        <ul className="text-sm">
          {(changes.data ?? []).map((ch, i) => (
            <li key={i}>
              {new Date(ch.changed_at).toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric", year: "numeric" })}: {ch.key} {String(ch.old_value)} to {String(ch.new_value)} by {(ch.changed_by && name.get(ch.changed_by)) || "a former admin"}. {ch.reason}
            </li>
          ))}
          {(changes.data ?? []).length === 0 ? <li className="text-neutral-500">No changes yet.</li> : null}
        </ul>
      </Section>
    </>
  );
}
