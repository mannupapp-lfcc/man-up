"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, requireAdmin } from "@/lib/admin";

export async function resolveReport(formData: FormData) {
  const { supabase } = await requireAdmin();
  const remove = formData.get("remove") === "true";
  const { error } = await supabase.rpc("resolve_report", { p_report: String(formData.get("report_id")), p_remove: remove });
  if (error) fail("/reports", error.message);
  revalidatePath("/reports");
  redirect(`/reports?notice=${encodeURIComponent(remove ? "Removed." : "Dismissed.")}`);
}
