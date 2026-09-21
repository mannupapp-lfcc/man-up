import { PlayIcon } from "@sanity/icons/Play";
import { defineArrayMember, defineField, defineType } from "sanity";
import { ministryField } from "./ministry-field";

export const lesson = defineType({
  name: "lesson",
  title: "Lesson",
  type: "document",
  icon: PlayIcon,
  fields: [
    ministryField,
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "videoUrl",
      title: "Video URL",
      type: "url",
      description: "Mux or Vimeo link. Video is hosted there, never in Supabase.",
    }),
    defineField({ name: "scriptureRef", title: "Key scripture", type: "string", description: "e.g. Joshua 1:8" }),
    defineField({ name: "scriptureText", title: "Scripture text", type: "text", rows: 3 }),
    defineField({ name: "body", title: "Teaching", type: "text", rows: 8 }),
    defineField({
      name: "reflectionQuestions",
      title: "Reflection questions",
      description: "2 or 3. Men's answers stay private to them.",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (rule) => rule.max(5),
    }),
  ],
  preview: { select: { title: "title", subtitle: "scriptureRef" } },
});
