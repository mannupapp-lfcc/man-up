import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { supabase } from "./supabase";

// Weekly discussion questions, written by the group's leader or co-leader in the app
// (group_weekly_questions, 0019). Only the men in the group can read them; only its
// leaders can write them (RLS: fn_in_group / fn_leads_group).

export const MAX_QUESTIONS = 10;
export const MAX_QUESTION_LENGTH = 500;
export const MAX_TITLE_LENGTH = 120;

export type QuestionSet = { id: string; weekOf: string; title: string | null; questions: string[] };

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Monday of the week, as a local calendar date "YYYY-MM-DD" (weeks start Monday).
export function mondayOf(date = new Date(), addWeeks = 0) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + addWeeks * 7);
  return iso(d);
}

export function weekLabel(weekOf: string) {
  return new Date(`${weekOf}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const toSet = (r: { id: string; week_of: string; title: string | null; questions: unknown }): QuestionSet =>
  ({ id: r.id, weekOf: r.week_of, title: r.title, questions: strings(r.questions) });

// The latest set for this week or earlier, plus next week's if a leader posted it early.
export function useGroupQuestions(groupId: string | null) {
  const [state, setState] = useState<Load<{ current: QuestionSet | null; next: QuestionSet | null }>>({ status: "loading" });
  const load = useCallback(async () => {
    if (!groupId) return setState({ status: "ready", data: { current: null, next: null } });
    const thisWeek = mondayOf();
    const nextWeek = mondayOf(new Date(), 1);
    const [current, next] = await Promise.all([
      supabase.from("group_weekly_questions").select("id, week_of, title, questions")
        .eq("group_id", groupId).lte("week_of", thisWeek).order("week_of", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("group_weekly_questions").select("id, week_of, title, questions")
        .eq("group_id", groupId).eq("week_of", nextWeek).maybeSingle(),
    ]);
    if (current.error || next.error) return setState({ status: "error" });
    setState({ status: "ready", data: { current: current.data ? toSet(current.data) : null, next: next.data ? toSet(next.data) : null } });
  }, [groupId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return { state, reload: load };
}

// One week's set, for the leader's editor.
export async function loadWeek(groupId: string, weekOf: string) {
  const { data, error } = await supabase.from("group_weekly_questions").select("id, week_of, title, questions")
    .eq("group_id", groupId).eq("week_of", weekOf).maybeSingle();
  if (error) return { error: error.message };
  return { set: data ? toSet(data) : null };
}

// Saves (or replaces) the group's questions for a week. Returns an error message or null.
export async function saveQuestions(input: {
  ministryId: string; groupId: string; me: string; weekOf: string; title: string; questions: string[];
}) {
  const questions = input.questions.map((q) => q.trim()).filter(Boolean);
  if (!questions.length) return "Write at least one question.";
  if (questions.length > MAX_QUESTIONS) return `At most ${MAX_QUESTIONS} questions.`;
  if (questions.some((q) => q.length > MAX_QUESTION_LENGTH)) return `Keep each question under ${MAX_QUESTION_LENGTH} characters.`;
  const title = input.title.trim();
  const { error } = await supabase.from("group_weekly_questions").upsert(
    {
      ministry_id: input.ministryId,
      group_id: input.groupId,
      week_of: input.weekOf,
      title: title ? title.slice(0, MAX_TITLE_LENGTH) : null,
      questions,
      posted_by: input.me,
    },
    { onConflict: "group_id,week_of" },
  );
  return error ? "Could not save the questions. Try again." : null;
}

export async function removeQuestions(groupId: string, weekOf: string) {
  const { error } = await supabase.from("group_weekly_questions").delete().eq("group_id", groupId).eq("week_of", weekOf);
  return error ? "Could not remove the questions. Try again." : null;
}
