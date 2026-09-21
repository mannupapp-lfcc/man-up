"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { syncContentFromSanity } from "@/lib/sanity/sync";
import { createServiceClient } from "@/lib/supabase/service";

export async function resyncContent() {
  await requireAdmin();
  let message: string;
  let ok = true;
  try {
    const s = await syncContentFromSanity(createServiceClient());
    message = `Synced ${s.courses} courses, ${s.lessons} lessons, ${s.gatherings} gathering pages, ${s.weekly} weeks of questions.` +
      (s.unpublished ? ` ${s.unpublished} no longer published.` : "") +
      (s.skipped.length ? ` Skipped: ${s.skipped.join("; ")}` : "");
  } catch (e) {
    ok = false;
    message = (e as Error).message;
  }
  revalidatePath("/content");
  redirect(`/content?${ok ? "notice" : "error"}=${encodeURIComponent(message)}`);
}
