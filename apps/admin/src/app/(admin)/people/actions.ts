"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, requireAdmin } from "@/lib/admin";

const ROLES = ["member", "co_leader", "leader", "admin"] as const;

export async function changeRole(formData: FormData) {
  const { supabase, ministryId, userId } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const role = String(formData.get("role"));
  const back = String(formData.get("back") ?? "/people");
  if (!(ROLES as readonly string[]).includes(role)) fail(back, "Unknown role.");
  if (profileId === userId) fail(back, "You cannot change your own role. Ask another admin.");

  const { error } = await supabase
    .from("ministry_members")
    .update({ role: role as (typeof ROLES)[number], role_since: new Date().toISOString().slice(0, 10) })
    .eq("ministry_id", ministryId)
    .eq("profile_id", profileId);
  if (error) fail(back, error.message);

  // A plain member does not lead a group.
  if (role === "member") {
    await supabase
      .from("group_members")
      .update({ is_group_leader: false })
      .eq("ministry_id", ministryId)
      .eq("profile_id", profileId)
      .is("left_at", null);
  }
  revalidatePath("/", "layout");
  redirect(back);
}

// Overseer (0020): an admin who reads every group's chat, prayer, and check-ins.
// The database refuses a self-grant and stamps who granted it.
export async function setOverseer(formData: FormData) {
  const { supabase, ministryId, userId } = await requireAdmin();
  const profileId = String(formData.get("profile_id"));
  const on = formData.get("on") === "true";
  const back = String(formData.get("back") ?? "/people");
  if (on && profileId === userId) fail(back, "Another admin must make you an overseer.");

  const { data, error } = await supabase
    .from("ministry_members")
    .update({ is_overseer: on })
    .eq("ministry_id", ministryId)
    .eq("profile_id", profileId)
    .eq("role", "admin")
    .is("left_at", null)
    .select("profile_id");
  if (error) fail(back, error.message);
  if (on && !data?.length) fail(back, "Only an admin can be an overseer. Make him an admin first.");
  revalidatePath("/", "layout");
  redirect(back);
}
