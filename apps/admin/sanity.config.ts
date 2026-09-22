"use client";

import { visionTool } from "@sanity/vision";
import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./src/sanity/schemaTypes";

// Sanity Studio, embedded at /studio (src/app/studio). Sanity authors content;
// Supabase mirrors published documents (api/sanity/webhook). The apps never read
// Sanity directly. basePath must match the route.
export default defineConfig({
  name: "man-up",
  title: "Man Up Content",
  projectId: "wf3m3duv",
  dataset: "production",
  basePath: "/studio",
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
