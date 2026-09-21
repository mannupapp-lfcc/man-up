import { UsersIcon } from "@sanity/icons/Users";
import { defineField, defineType } from "sanity";

export const ministry = defineType({
  name: "ministry",
  title: "Ministry",
  type: "document",
  icon: UsersIcon,
  fields: [
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "key",
      title: "Ministry key",
      type: "string",
      description: "Must match the app's ministry key exactly, e.g. manup. Do not change after content exists.",
      validation: (rule) => rule.required().regex(/^[a-z0-9_]+$/, { name: "lowercase key" }),
    }),
  ],
});
