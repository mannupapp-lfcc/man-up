import { BookIcon } from "@sanity/icons/Book";
import { defineArrayMember, defineField, defineType } from "sanity";
import { ministryField } from "./ministry-field";

export const course = defineType({
  name: "course",
  title: "Course",
  type: "document",
  icon: BookIcon,
  fields: [
    ministryField,
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "description", type: "text", rows: 3 }),
    defineField({
      name: "lessons",
      title: "Lessons (in order)",
      type: "array",
      of: [defineArrayMember({ type: "reference", to: [{ type: "lesson" }] })],
      validation: (rule) => rule.unique(),
    }),
  ],
  preview: { select: { title: "title", subtitle: "ministry.title" } },
});
