import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

// Content authored in Sanity and mirrored into Supabase (the app never reads Sanity).

type Load<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };

function useLoad<T>(fn: () => Promise<T | null>, deps: unknown[]) {
  const [state, setState] = useState<Load<T>>({ status: "loading" });
  const load = useCallback(async () => {
    const data = await fn();
    setState(data === null ? { status: "error" } : { status: "ready", data });
  }, deps);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  return { state, reload: load };
}

export type CourseSummary = { id: string; title: string; description: string | null; lessons: number; completed: number };

export function useCourses() {
  const { state: auth } = useAuth();
  const me = auth.status === "ready" ? auth.session.user.id : null;
  return useLoad<CourseSummary[]>(async () => {
    const [courses, progress] = await Promise.all([
      supabase.from("courses").select("id, title, description, lessons(id)").order("title"),
      supabase.from("lesson_progress").select("lesson_id, completed_at").eq("profile_id", me ?? ""),
    ]);
    if (courses.error || progress.error) return null;
    const done = new Set(progress.data.filter((p) => p.completed_at).map((p) => p.lesson_id));
    return courses.data.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      lessons: c.lessons.length,
      completed: c.lessons.filter((l) => done.has(l.id)).length,
    }));
  }, [me]);
}

export type LessonRow = { id: string; title: string; order: number; completed: boolean };

export function useCourse(courseId: string) {
  const { state: auth } = useAuth();
  const me = auth.status === "ready" ? auth.session.user.id : null;
  return useLoad<{ title: string; description: string | null; lessons: LessonRow[] }>(async () => {
    const [course, progress] = await Promise.all([
      supabase.from("courses").select("title, description, lessons(id, title, sort_order)").eq("id", courseId).maybeSingle(),
      supabase.from("lesson_progress").select("lesson_id, completed_at").eq("profile_id", me ?? ""),
    ]);
    if (course.error || progress.error || !course.data) return null;
    const done = new Set(progress.data.filter((p) => p.completed_at).map((p) => p.lesson_id));
    return {
      title: course.data.title,
      description: course.data.description,
      lessons: course.data.lessons
        .map((l) => ({ id: l.id, title: l.title, order: l.sort_order, completed: done.has(l.id) }))
        .sort((a, b) => a.order - b.order),
    };
  }, [courseId, me]);
}

export type Lesson = {
  id: string;
  title: string;
  videoUrl: string | null;
  scriptureRef: string | null;
  scriptureText: string | null;
  body: string | null;
  questions: string[];
  reflection: string;
  completedAt: string | null;
};

export function useLesson(lessonId: string) {
  const { state: auth } = useAuth();
  const me = auth.status === "ready" ? auth.session.user.id : null;
  return useLoad<Lesson>(async () => {
    const [lesson, progress] = await Promise.all([
      supabase
        .from("lessons")
        .select("id, title, video_url, scripture_ref, scripture_text, body, reflection_questions")
        .eq("id", lessonId)
        .maybeSingle(),
      supabase.from("lesson_progress").select("reflection, completed_at").eq("lesson_id", lessonId).eq("profile_id", me ?? "").maybeSingle(),
    ]);
    if (lesson.error || progress.error || !lesson.data) return null;
    const q = lesson.data.reflection_questions;
    return {
      id: lesson.data.id,
      title: lesson.data.title,
      videoUrl: lesson.data.video_url,
      scriptureRef: lesson.data.scripture_ref,
      scriptureText: lesson.data.scripture_text,
      body: lesson.data.body,
      questions: Array.isArray(q) ? q.filter((x): x is string => typeof x === "string") : [],
      reflection: progress.data?.reflection ?? "",
      completedAt: progress.data?.completed_at ?? null,
    };
  }, [lessonId, me]);
}

// Reflections are private to the man (RLS: own rows only; never in any dashboard).
export async function saveProgress(input: { ministryId: string; me: string; lessonId: string; reflection: string; complete?: boolean }) {
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      ministry_id: input.ministryId,
      lesson_id: input.lessonId,
      profile_id: input.me,
      reflection: input.reflection.trim() || null,
      ...(input.complete ? { completed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "lesson_id,profile_id" },
  );
  return error?.message ?? null;
}

export type WeeklyQuestions = { title: string | null; weekOf: string; questions: string[] };

// This week's questions (the latest set on or before today).
export function useWeeklyQuestions() {
  return useLoad<WeeklyQuestions | undefined>(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("weekly_questions")
      .select("title, week_of, questions")
      .lte("week_of", today)
      .order("week_of", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return null;
    if (!data) return undefined;
    const q = data.questions;
    return { title: data.title, weekOf: data.week_of, questions: Array.isArray(q) ? q.filter((x): x is string => typeof x === "string") : [] };
  }, []);
}

export type GatheringContent = {
  topic: string | null;
  teacher: string | null;
  prework: string[];
  recap: string | null;
  takehome: string[];
};

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function useGatheringContent(date: Date | null) {
  // Local calendar date of the gathering (content attaches by date).
  const day = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : null;
  return useLoad<GatheringContent | undefined>(async () => {
    if (!day) return undefined;
    const { data, error } = await supabase
      .from("gathering_content")
      .select("topic, teacher, prework_questions, recap, takehome_questions")
      .eq("gathering_date", day)
      .maybeSingle();
    if (error) return null;
    if (!data) return undefined;
    return {
      topic: data.topic,
      teacher: data.teacher,
      prework: strings(data.prework_questions),
      recap: data.recap,
      takehome: strings(data.takehome_questions),
    };
  }, [day]);
}
