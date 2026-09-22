import { CommentIcon } from "@sanity/icons/Comment";
import { defineArrayMember, defineField, defineType } from "sanity";
import { ministryField } from "./ministry-field";

export const weeklyQuestions = defineType({
  name: "weeklyQuestions",
  title: "Weekly questions",
  type: "document",
  icon: CommentIcon,
  fields: [
    ministryField,
    defineField({
      name: "weekOf",
      title: "Week of (Monday)",
      type: "date",
      validation: (rule) =>
        rule.required().custom((d) => (!d || new Date(`${d}T12:00:00`).getDay() === 1 ? true : "Pick the Monday of the week")),
    }),
    defineField({ name: "title", type: "string", description: "Optional, e.g. the gathering's topic." }),
    defineField({
      name: "questions",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: { select: { title: "title", subtitle: "weekOf" } },
});
