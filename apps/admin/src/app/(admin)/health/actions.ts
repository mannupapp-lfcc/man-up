"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { scoreMinistry } from "@/lib/scoring/run";
import { createServiceClient } from "@/lib/supabase/service";

export async function runScoringNow() {
  const { ministryId } = await requireAdmin();
  let q: string;
  try {
    const s = await scoreMinistry(createServiceClient(), ministryId);
    q = `notice=${encodeURIComponent(`Scored ${s.members} men, ${s.leaders} leaders, ${s.groups} groups.`)}`;
  } catch (e) {
    q = `error=${encodeURIComponent((e as Error).message)}`;
  }
  revalidatePath("/health");
  redirect(`/health?${q}`);
}

export async function endSeasonFlag(formData: FormData) {
  const { supabase } = await requireAdmin();
  await supabase.from("season_flags").delete().eq("id", String(formData.get("id")));
  revalidatePath("/health");
  redirect("/health");
}
