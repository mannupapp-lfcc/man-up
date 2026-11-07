import { Flash, PageTitle, Section, Submit } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { resyncContent } from "./actions";

export default async function ContentPage({ searchParams }: PageProps<"/content">) {
  const { error, notice } = await searchParams;
  const { supabase, ministryId, timeZone } = await requireAdmin();

  const [courses, lessons, gatherings] = await Promise.all([
    supabase.from("courses").select("title, synced_at").eq("ministry_id", ministryId).eq("is_published", true).order("title"),
    supabase.from("lessons").select("id", { count: "exact", head: true }).eq("ministry_id", ministryId),
    supabase.from("gathering_content").select("gathering_date, topic").eq("ministry_id", ministryId).order("gathering_date", { ascending: false }).limit(5),
  ]);
  const day = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric", year: "numeric" });

  return (
    <>
      <PageTitle sub="Content is written in Sanity Studio. Publishing there updates the app within seconds; this page shows what the app has. Weekly discussion questions are written by group leaders in the app.">
        Content
      </PageTitle>
      <Flash error={error} notice={notice} />
      <Section title="Sync">
        <p className="mb-3 text-sm text-neutral-500">Use this if something published in Sanity is not showing in the app.</p>
        <form action={resyncContent}><Submit>Resync from Sanity</Submit></form>
      </Section>
      <Section title={`Courses (${courses.data?.length ?? 0}), ${lessons.count ?? 0} lessons`}>
        <ul className="text-sm">{(courses.data ?? []).map((c) => <li key={c.title}>{c.title}</li>)}</ul>
      </Section>
      <Section title="Gathering pages (latest)">
        <ul className="text-sm">{(gatherings.data ?? []).map((g) => <li key={g.gathering_date + g.topic}>{day(g.gathering_date)}: {g.topic ?? "No topic yet"}</li>)}</ul>
      </Section>
    </>
  );
}
