import { Flash, PageTitle, Section, Submit, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { pcoGetAll } from "@/lib/pco/client";
import { clearMatch, confirmMatch, previewSync, saveCheckInEvents, syncNow } from "./actions";

const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "").slice(-10);
const lower = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

// Check-Ins events are listed live from PCO (GET only) so the admin can pick the one
// the church sets up for Saturday gatherings. Men-related names are listed first.
async function listCheckInEvents() {
  try {
    const { data } = await pcoGetAll("/check_ins/v2/events?per_page=100");
    return data
      .filter((e) => !e.attributes.archived_at)
      .map((e) => ({ id: e.id, name: String(e.attributes.name ?? "").trim() }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return null;
  }
}

export default async function PcoPage({ searchParams }: PageProps<"/pco">) {
  const { error, notice } = await searchParams;
  const { supabase, ministryId, timeZone } = await requireAdmin();

  const [{ data: logs }, { data: config }, { data: roster }, { data: people }, checkInEvents] = await Promise.all([
    supabase.from("pco_sync_log").select("resource, rows_upserted, status, error, ran_at").eq("ministry_id", ministryId)
      .order("ran_at", { ascending: false }).limit(6),
    supabase.from("ministry_config").select("key, value").eq("ministry_id", ministryId)
      .in("key", ["pco_group_id", "pco_checkin_event_ids"]),
    supabase.from("pco_roster").select("pco_person_id, full_name, email, phone").eq("ministry_id", ministryId).order("full_name"),
    supabase.from("ministry_members").select("profile_id, profiles(full_name, email, phone, pco_person_id)")
      .eq("ministry_id", ministryId).is("left_at", null),
    listCheckInEvents(),
  ]);

  const groupId = config?.find((c) => c.key === "pco_group_id")?.value;
  const chosenRaw = config?.find((c) => c.key === "pco_checkin_event_ids")?.value;
  const chosen = new Set(Array.isArray(chosenRaw) ? chosenRaw.map(String) : []);

  const matchedIds = new Set((people ?? []).map((p) => p.profiles?.pco_person_id).filter(Boolean));
  const unmatchedRoster = (roster ?? []).filter((r) => !matchedIds.has(r.pco_person_id));
  const unmatched = (people ?? []).filter((p) => p.profiles && !p.profiles.pco_person_id);
  const matched = (people ?? []).filter((p) => p.profiles?.pco_person_id);
  const rosterName = new Map((roster ?? []).map((r) => [r.pco_person_id, r.full_name]));

  const suggestionFor = (p: (typeof unmatched)[number]) =>
    unmatchedRoster.find(
      (r) =>
        (lower(r.email) && lower(r.email) === lower(p.profiles?.email)) ||
        (digits(r.phone).length === 10 && digits(r.phone) === digits(p.profiles?.phone)),
    );

  const menFirst = (checkInEvents ?? []).sort(
    (a, b) => Number(/\bm[ae]n|stepping|forge/i.test(b.name)) - Number(/\bm[ae]n|stepping|forge/i.test(a.name)),
  );
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <PageTitle sub={`Read-only mirror of PCO group ${typeof groupId === "string" ? groupId : "(not set)"}. The app never writes to Planning Center.`}>
        Planning Center
      </PageTitle>
      <Flash error={error} notice={notice} />

      <Section title="Sync">
        <p className="mb-3 text-sm text-neutral-500">Runs every night at 2:00 am. Preview reads PCO and saves nothing.</p>
        <div className="mb-4 flex gap-3">
          <form action={previewSync}><Submit variant="secondary">Preview</Submit></form>
          <form action={syncNow}><Submit>Sync now</Submit></form>
        </div>
        <ul className="text-sm">
          {(logs ?? []).map((l, i) => (
            <li key={i} className={l.status === "error" ? "text-red-700 dark:text-red-300" : ""}>
              {when(l.ran_at)}: {l.resource.replace("_", " ")} {l.status === "ok" ? `(${l.rows_upserted})` : `failed: ${l.error}`}
            </li>
          ))}
          {(logs ?? []).length === 0 ? <li className="text-neutral-500">No syncs yet.</li> : null}
        </ul>
      </Section>

      <Section title="Saturday attendance">
        <p className="mb-3 text-sm text-neutral-500">
          Choose the PCO Check-Ins events whose check-ins count as gathering attendance. Only who checked in and when is
          kept.
        </p>
        {checkInEvents === null ? (
          <p className="text-sm text-red-700 dark:text-red-300">Could not reach Planning Center to list Check-Ins events.</p>
        ) : (
          <form action={saveCheckInEvents} className="flex flex-col gap-3">
            <div className="max-h-64 overflow-y-auto rounded-md border border-neutral-300 p-3 dark:border-navy">
              {menFirst.map((e) => (
                <label key={e.id} className="flex items-center gap-2 py-1 text-sm">
                  <input type="checkbox" name="event_id" value={e.id} defaultChecked={chosen.has(e.id)} className="accent-gold" />
                  {e.name}
                </label>
              ))}
            </div>
            <div><Submit>Save</Submit></div>
          </form>
        )}
      </Section>

      <Section title={`Match queue (${unmatched.length})`}>
        <p className="mb-3 text-sm text-neutral-500">
          Link each man to his PCO record so his Saturday check-ins count. Suggestions come from matching email or phone;
          nothing is linked until you confirm.
        </p>
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {unmatched.map((p) => {
            const suggestion = suggestionFor(p);
            return (
              <li key={p.profile_id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="min-w-48 flex-1">
                  <span className="font-medium">{p.profiles?.full_name}</span>
                  <span className="ml-2 text-sm text-neutral-500">{p.profiles?.email}</span>
                </span>
                <form action={confirmMatch} className="flex flex-wrap gap-2">
                  <input type="hidden" name="profile_id" value={p.profile_id} />
                  <select name="pco_person_id" required defaultValue={suggestion?.pco_person_id ?? ""} className={inputClass}>
                    <option value="" disabled>Choose his PCO record</option>
                    {unmatchedRoster.map((r) => (
                      <option key={r.pco_person_id} value={r.pco_person_id}>
                        {r.full_name}{r.email ? `, ${r.email}` : ""}{suggestion?.pco_person_id === r.pco_person_id ? " (suggested)" : ""}
                      </option>
                    ))}
                  </select>
                  <Submit>{suggestion ? "Confirm" : "Match"}</Submit>
                </form>
              </li>
            );
          })}
          {unmatched.length === 0 ? <li className="py-2 text-sm text-neutral-500">Everyone is matched.</li> : null}
        </ul>
      </Section>

      <Section title={`Matched (${matched.length})`}>
        <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
          {matched.map((p) => (
            <li key={p.profile_id} className="flex items-center gap-3 py-2">
              <span className="flex-1">
                {p.profiles?.full_name}
                <span className="ml-2 text-neutral-500">PCO: {rosterName.get(p.profiles?.pco_person_id ?? "") ?? p.profiles?.pco_person_id}</span>
              </span>
              <form action={clearMatch}>
                <input type="hidden" name="profile_id" value={p.profile_id} />
                <Submit variant="secondary">Clear</Submit>
              </form>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
