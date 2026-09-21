"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, requireAdmin } from "@/lib/admin";

export async function updateSetting(formData: FormData) {
  const { supabase, ministryId } = await requireAdmin();
  const value = Number(formData.get("value"));
  if (!Number.isFinite(value)) fail("/scoring", "Enter a number.");
  const { error } = await supabase.rpc("set_score_config", {
    p_ministry: ministryId,
    p_key: String(formData.get("key")),
    p_value: value,
    p_reason: String(formData.get("reason") ?? ""),
  });
  if (error) fail("/scoring", error.message);
  revalidatePath("/scoring");
  redirect(`/scoring?notice=${encodeURIComponent("Saved. Takes effect at the next scoring run.")}`);
}
