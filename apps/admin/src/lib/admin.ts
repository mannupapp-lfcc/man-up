import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

// Every admin page starts here. Signed-in but not an admin of an active ministry:
// back to /login with a message. The database enforces the same rule through RLS;
// this only keeps non-admins from seeing empty screens.
export async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: membership } = await supabase
    .from("ministry_members")
    .select("ministry_id, ministries(name)")
    .eq("profile_id", userId)
    .eq("role", "admin")
    .is("left_at", null)
    .limit(1)
    .maybeSingle();

  if (!membership?.ministries) redirect("/login?error=not-admin");

  const { data: tz } = await supabase
    .from("ministry_config")
    .select("value")
    .eq("ministry_id", membership.ministry_id)
    .eq("key", "timezone")
    .maybeSingle();

  return {
    // Meeting times display in the ministry's own timezone (ministry_config).
    timeZone: typeof tz?.value === "string" ? tz.value : "UTC",
    supabase,
    userId,
    ministryId: membership.ministry_id,
    ministryName: membership.ministries.name,
  };
}

// Redirect back to a page with an error message (shown by <Flash />).
export function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}
