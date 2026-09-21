import {
  createClient,
  type SupabaseClient,
  type SupabaseClientOptions,
} from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type ManUpClient = SupabaseClient<Database>;

// Each app passes its own URL, key, and auth storage. Mobile uses the anon key with
// AsyncStorage; admin server code may pass the service role key. This package never
// reads env vars itself, so a secret can't be bundled into the mobile app by accident.
export function createSupabaseClient(
  url: string,
  key: string,
  options?: SupabaseClientOptions<"public">,
): ManUpClient {
  return createClient<Database>(url, key, options);
}
