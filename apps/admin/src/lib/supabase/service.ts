import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@manup/shared";

// Service role: bypasses RLS. Only for server-side jobs (the PCO sync). Never used to
// serve a page's data; pages use the signed-in admin's own client.
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient<Database>(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
