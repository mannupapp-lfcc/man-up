import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schemaTypes";

// Sanity authors content; Supabase mirrors published documents (apps/admin webhook).
// The apps never read Sanity directly.
export default defineConfig({
  name: "man-up",
  title: "Man Up Content",
  projectId: "wf3m3duv",
  dataset: "production",
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
