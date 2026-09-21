import "server-only";
import { createClient } from "@sanity/client";

// Read-only: published documents only, with a Viewer token. The apps never read
// Sanity directly; this is used only to mirror content into Supabase.
export const sanity = createClient({
  projectId: process.env.SANITY_PROJECT_ID ?? "wf3m3duv",
  dataset: process.env.SANITY_DATASET ?? "production",
  apiVersion: "2025-02-19",
  token: process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
  perspective: "published",
});
