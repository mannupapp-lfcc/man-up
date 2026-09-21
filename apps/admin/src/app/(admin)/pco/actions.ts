"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, requireAdmin } from "@/lib/admin";
import { syncMinistry, type SyncSummary } from "@/lib/pco/sync";
import { createServiceClient } from "@/lib/supabase/service";

function describe(s: SyncSummary, dryRun: boolean) {
  if (s.skipped) return s.skipped;
  const parts = [
    `${s.roster ?? 0} men on the PCO roster`,
    `${s.events ?? 0} events`,
    s.checkIns === undefined ? "no Check-Ins events chosen yet" : `${s.checkIns} check-ins`,
  ];
  const head = dryRun ? "Preview only, nothing saved: found" : "Synced";
  return `${head} ${parts.join(", ")}.${s.errors.length ? ` Problems: ${s.errors.join("; ")}` : ""}`;
}

// Runs the same sync as the nightly job, for this admin's ministry only. The
// service role is used server-side, after requireAdmin() confirmed who is asking.
async function run(dryRun: boolean) {
  const { ministryId } = await requireAdmin();
  const summary = await syncMinistry(createServiceClient(), ministryId, { dryRun });
  revalidatePath("/", "layout");
  const key = summary.errors.length ? "error" : "notice";
  redirect(`/pco?${key}=${encodeURIComponent(describe(summary, dryRun))}`);
}

export async function previewSync() {
  await run(true);
}

export async function syncNow() {
  await run(false);
}

export async function saveCheckInEvents(formData: FormData) {
  const { supabase, ministryId } = await requireAdmin();
  const ids = formData.getAll("event_id").map(String).filter((id) => /^\d+$/.test(id));
  const { error } = await supabase
    .from("ministry_config")
    .upsert({ ministry_id: ministryId, key: "pco_checkin_event_ids", value: ids }, { onConflict: "ministry_id,key" });
  if (error) fail("/pco", error.message);
  revalidatePath("/pco");
  redirect(`/pco?notice=${encodeURIComponent("Saved. Check-ins from these events count from the next sync.")}`);
}

export async function confirmMatch(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("confirm_pco_match", {
    p_profile: String(formData.get("profile_id")),
    p_pco_person_id: String(formData.get("pco_person_id")),
  });
  if (error) fail("/pco", error.message);
  revalidatePath("/", "layout");
  redirect("/pco");
}

export async function clearMatch(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("clear_pco_match", { p_profile: String(formData.get("profile_id")) });
  if (error) fail("/pco", error.message);
  revalidatePath("/", "layout");
  redirect("/pco");
}
