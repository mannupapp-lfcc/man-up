import { CalendarIcon } from "@sanity/icons/Calendar";
import { defineArrayMember, defineField, defineType } from "sanity";
import { ministryField } from "./ministry-field";

// Content for one Saturday gathering. The gathering itself (date, time, place,
// cancellation) comes from Planning Center; this attaches to it by date.
export const gatheringContent = defineType({
  name: "gatheringContent",
  title: "Gathering content",
  type: "document",
  icon: CalendarIcon,
  fields: [
    ministryField,
    defineField({
      name: "date",
      title: "Gathering date",
      type: "date",
      description: "The Saturday this is for (must match the gathering in Planning Center).",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "topic", type: "string" }),
    defineField({ name: "teacher", type: "string" }),
    defineField({
      name: "preworkQuestions",
      title: "Pre-work questions",
      description: "Posted before the gathering so men come prepared.",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
    }),
    defineField({ name: "recap", type: "text", rows: 5, description: "Posted after the gathering." }),
    defineField({
      name: "takehomeQuestions",
      title: "Take-home questions",
      description: "Flow into that week's group discussion.",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
    }),
  ],
  preview: { select: { title: "topic", subtitle: "date" } },
});
