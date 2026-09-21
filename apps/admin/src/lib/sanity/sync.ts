import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@manup/shared";
import { sanity } from "./client";

type Db = SupabaseClient<Database>;

const CONTENT_QUERY = `{
  "courses": *[_type == "course"]{
    _id, title, description, "ministryKey": ministry->key,
    "lessons": lessons[]->{ _id, title, videoUrl, scriptureRef, scriptureText, body, reflectionQuestions, "ministryKey": ministry->key }
  },
  "gatherings": *[_type == "gatheringContent"]{
    _id, "ministryKey": ministry->key, date, topic, teacher, preworkQuestions, recap, takehomeQuestions
  },
  "weekly": *[_type == "weeklyQuestions"]{ _id, "ministryKey": ministry->key, weekOf, title, questions }
}`;

type Lesson = {
  _id: string; title: string; videoUrl?: string; scriptureRef?: string; scriptureText?: string;
  body?: string; reflectionQuestions?: string[]; ministryKey?: string;
} | null;
type Content = {
  courses: { _id: string; title: string; description?: string; ministryKey?: string; lessons?: Lesson[] }[];
  gatherings: {
    _id: string; ministryKey?: string; date?: string; topic?: string; teacher?: string;
    preworkQuestions?: string[]; recap?: string; takehomeQuestions?: string[];
  }[];
  weekly: { _id: string; ministryKey?: string; weekOf?: string; title?: string; questions?: string[] }[];
};

export type ContentSummary = { courses: number; lessons: number; gatherings: number; weekly: number; unpublished: number; skipped: string[] };

// Mirrors every published Sanity document into Supabase, routed by the document's
// ministry key. Anything no longer published is marked is_published = false (never
// deleted, so progress rows keep pointing at real lessons). Seed rows are left alone.
export async function syncContentFromSanity(db: Db): Promise<ContentSummary> {
  const content = await sanity.fetch<Content>(CONTENT_QUERY);
  const { data: ministries } = await db.from("ministries").select("id, ministry_key");
  const ministryId = new Map((ministries ?? []).map((m) => [m.ministry_key, m.id]));
  const now = new Date().toISOString();
  const skipped: string[] = [];
  const route = (key: string | undefined, what: string) => {
    const id = key ? ministryId.get(key) : undefined;
    if (!id) skipped.push(`${what} (ministry key "${key ?? "missing"}" not found)`);
    return id;
  };

  const seen = { courses: new Set<string>(), lessons: new Set<string>(), gatherings: new Set<string>(), weekly: new Set<string>() };

  for (const course of content.courses) {
    const mid = route(course.ministryKey, `course "${course.title}"`);
    if (!mid) continue;
    const { data: row, error } = await db
      .from("courses")
      .upsert({ ministry_id: mid, sanity_id: course._id, title: course.title, description: course.description ?? null, is_published: true, synced_at: now }, { onConflict: "sanity_id" })
      .select("id")
      .single();
    if (error) throw new Error(`course ${course._id}: ${error.message}`);
    seen.courses.add(course._id);

    const lessons = (course.lessons ?? []).filter((l): l is NonNullable<Lesson> => !!l);
    for (const [i, l] of lessons.entries()) {
      // Tenancy: a lesson must belong to the same ministry as its course.
      if (l.ministryKey !== course.ministryKey) {
        skipped.push(`lesson "${l.title}" (different ministry than course "${course.title}")`);
        continue;
      }
      const up = await db.from("lessons").upsert(
        {
          ministry_id: mid, course_id: row.id, sanity_id: l._id, title: l.title, sort_order: i + 1,
          video_url: l.videoUrl ?? null, scripture_ref: l.scriptureRef ?? null, scripture_text: l.scriptureText ?? null,
          body: l.body ?? null, reflection_questions: l.reflectionQuestions ?? [], is_published: true, synced_at: now,
        },
        { onConflict: "sanity_id" },
      );
      if (up.error) throw new Error(`lesson ${l._id}: ${up.error.message}`);
      seen.lessons.add(l._id);
    }
  }

  for (const g of content.gatherings) {
    const mid = route(g.ministryKey, `gathering content ${g.date ?? g._id}`);
    if (!mid || !g.date) continue;
    const up = await db.from("gathering_content").upsert(
      {
        ministry_id: mid, sanity_id: g._id, gathering_date: g.date, topic: g.topic ?? null, teacher: g.teacher ?? null,
        prework_questions: g.preworkQuestions ?? [], recap: g.recap ?? null, takehome_questions: g.takehomeQuestions ?? [],
        is_published: true, synced_at: now,
      },
      { onConflict: "sanity_id" },
    );
    if (up.error) throw new Error(`gathering content ${g._id}: ${up.error.message}`);
    seen.gatherings.add(g._id);
  }

  for (const w of content.weekly) {
    const mid = route(w.ministryKey, `weekly questions ${w.weekOf ?? w._id}`);
    if (!mid || !w.weekOf) continue;
    const up = await db.from("weekly_questions").upsert(
      { ministry_id: mid, sanity_id: w._id, week_of: w.weekOf, title: w.title ?? null, questions: w.questions ?? [], is_published: true, synced_at: now },
      { onConflict: "sanity_id" },
    );
    if (up.error) throw new Error(`weekly questions ${w._id}: ${up.error.message}`);
    seen.weekly.add(w._id);
  }

  // Unpublish whatever Sanity no longer has (skip seed rows).
  let unpublished = 0;
  const sweep = async (table: "courses" | "lessons" | "gathering_content" | "weekly_questions", keep: Set<string>) => {
    const { data } = await db.from(table).select("sanity_id").eq("is_published", true);
    const gone = (data ?? []).map((r) => r.sanity_id).filter((id) => !keep.has(id) && !id.startsWith("seed-"));
    if (gone.length) {
      await db.from(table).update({ is_published: false }).in("sanity_id", gone);
      unpublished += gone.length;
    }
  };
  await sweep("courses", seen.courses);
  await sweep("lessons", seen.lessons);
  await sweep("gathering_content", seen.gatherings);
  await sweep("weekly_questions", seen.weekly);

  const summary = {
    courses: seen.courses.size, lessons: seen.lessons.size, gatherings: seen.gatherings.size, weekly: seen.weekly.size,
    unpublished, skipped,
  };
  await db.from("sanity_sync_log").insert({ document_type: "all", sanity_id: "*", action: `sync ${JSON.stringify(summary)}`.slice(0, 500) });
  return summary;
}
