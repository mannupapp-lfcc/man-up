import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@manup/shared";
import { cookies } from "next/headers";

// Per-request client acting as the signed-in admin (anon key + his session), so
// RLS applies to everything the admin site does. The service role is not used here.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components cannot write cookies; the proxy refreshes the session.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    },
  );
}
