"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, requireAdmin } from "@/lib/admin";

// No 0/O or 1/I/L, so codes survive being read aloud or copied by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const ROLES = ["co_leader", "leader", "admin"] as const;

function newCode() {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export async function createInvite(formData: FormData) {
  const { supabase, ministryId, userId } = await requireAdmin();
  const role = String(formData.get("role"));
  if (!(ROLES as readonly string[]).includes(role)) fail("/invites", "Choose a role.");
  const maxUses = Number(formData.get("max_uses")) || null;
  const days = Number(formData.get("expires_days")) || null;

  const code = newCode();
  const { error } = await supabase.from("invite_codes").insert({
    ministry_id: ministryId,
    code,
    role_granted: role as (typeof ROLES)[number],
    max_uses: maxUses,
    expires_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
    created_by: userId,
  });
  if (error) fail("/invites", error.message);
  revalidatePath("/invites");
  redirect(`/invites?notice=${encodeURIComponent(`Created code ${code}.`)}`);
}

export async function revokeInvite(formData: FormData) {
  const { supabase, ministryId } = await requireAdmin();
  const { error } = await supabase
    .from("invite_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("ministry_id", ministryId)
    .eq("id", String(formData.get("id")));
  if (error) fail("/invites", error.message);
  revalidatePath("/invites");
  redirect("/invites");
}
