import { defineField } from "sanity";

// Every content document belongs to one ministry (multi-tenant). The sync routes it
// to Supabase by the ministry's key.
export const ministryField = defineField({
  name: "ministry",
  title: "Ministry",
  type: "reference",
  to: [{ type: "ministry" }],
  validation: (rule) => rule.required(),
});
