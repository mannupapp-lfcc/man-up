"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { DbEnum } from "@manup/shared";
import { fail, requireAdmin } from "@/lib/admin";
import { DAYS } from "@/components/ui";

const STATUSES = ["forming", "active", "archived"] as const;

function readGroup(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const day = String(formData.get("meeting_day") ?? "");
  const time = String(formData.get("meeting_time") ?? "");
  const status = String(formData.get("status") ?? "forming");
  return {
    name,
    meeting_day: (DAYS as readonly string[]).includes(day) ? day : null,
    meeting_time: /^\d{2}:\d{2}$/.test(time) ? time : null,
    status: ((STATUSES as readonly string[]).includes(status) ? status : "forming") as DbEnum<"group_status">,
  };
}

export async function createGroup(formData: FormData) {
  const { supabase, ministryId } = await requireAdmin();
  const group = readGroup(formData);
  if (!group.name) fail("/groups", "Give the group a name.");
  const { data, error } = await supabase
    .from("groups")
    .insert({ ...group, ministry_id: ministryId })
    .select("id")
    .single();
  if (error) fail("/groups", error.message);
  await supabase.rpc("generate_meetings", { p_ministry: ministryId });
  revalidatePath("/groups");
  redirect(`/groups/${data.id}`);
}

export async function updateGroup(formData: FormData) {
  const { supabase, ministryId } = await requireAdmin();
  const id = String(formData.get("group_id"));
  const group = readGroup(formData);
  if (!group.name) fail(`/groups/${id}`, "Give the group a name.");
  const { error } = await supabase.from("groups").update(group).eq("id", id).eq("ministry_id", ministryId);
  if (error) fail(`/groups/${id}`, error.message);
  // Moves future meetings to the new schedule (never ones with attendance).
  const gen = await supabase.rpc("generate_meetings", { p_ministry: ministryId });
  if (gen.error) fail(`/groups/${id}`, gen.error.message);
  revalidatePath(`/groups/${id}`);
  redirect(`/groups/${id}?notice=${encodeURIComponent("Group saved.")}`);
}

export async function placeMember(formData: FormData) {
  const { supabase } = await requireAdmin();
  const groupId = String(formData.get("group_id"));
  const back = String(formData.get("back") ?? `/groups/${groupId}`);
  const { error } = await supabase.rpc("place_member", {
    p_group: groupId,
    p_profile: String(formData.get("profile_id")),
  });
  if (error) fail(back, error.message);
  revalidatePath("/", "layout");
  redirect(back);
}

export async function removeFromGroup(formData: FormData) {
  const { supabase, ministryId } = await requireAdmin();
  const groupId = String(formData.get("group_id"));
  const { error } = await supabase
    .from("group_members")
    .update({ left_at: new Date().toISOString(), is_group_leader: false })
    .eq("ministry_id", ministryId)
    .eq("group_id", groupId)
    .eq("profile_id", String(formData.get("profile_id")))
    .is("left_at", null);
  if (error) fail(`/groups/${groupId}`, error.message);
  revalidatePath("/", "layout");
  redirect(`/groups/${groupId}`);
}

export async function setLeader(formData: FormData) {
  const { supabase } = await requireAdmin();
  const groupId = String(formData.get("group_id"));
  const role = String(formData.get("role")) === "leader" ? "leader" : "co_leader";
  const { error } = await supabase.rpc("set_group_leader", {
    p_group: groupId,
    p_profile: String(formData.get("profile_id")),
    p_role: role,
  });
  if (error) fail(`/groups/${groupId}`, error.message);
  revalidatePath("/", "layout");
  redirect(`/groups/${groupId}`);
}

// Stops leading this group. His ministry role is left alone (change it on People).
export async function clearLeader(formData: FormData) {
  const { supabase, ministryId } = await requireAdmin();
  const groupId = String(formData.get("group_id"));
  const { error } = await supabase
    .from("group_members")
    .update({ is_group_leader: false })
    .eq("ministry_id", ministryId)
    .eq("group_id", groupId)
    .eq("profile_id", String(formData.get("profile_id")))
    .is("left_at", null);
  if (error) fail(`/groups/${groupId}`, error.message);
  revalidatePath("/", "layout");
  redirect(`/groups/${groupId}`);
}
