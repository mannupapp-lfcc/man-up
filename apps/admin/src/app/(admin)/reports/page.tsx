import { Flash, PageTitle, Section, Submit } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { resolveReport } from "./actions";

const TYPE_LABEL = { group_message: "Group chat message", prayer_request: "Prayer request", prayer_comment: "Prayer comment" } as const;

// Privacy wall: admins see only the reported item, and only while its report is
// open (RLS). Never the rest of the chat or prayer wall, and never an anonymous
// author.
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const { error, notice } = await searchParams;
  const { supabase, ministryId, timeZone } = await requireAdmin();

  const [{ data: reports }, { data: blocks }] = await Promise.all([
    supabase.from("content_reports").select("id, target_type, target_id, reason, created_at, reporter_id")
      .eq("ministry_id", ministryId).eq("status", "open").order("created_at"),
    supabase.from("user_blocks").select("blocker_id, blocked_id, created_at")
      .eq("ministry_id", ministryId).order("created_at", { ascending: false }).limit(20),
  ]);

  const ids = (t: string) => (reports ?? []).filter((r) => r.target_type === t).map((r) => r.target_id);
  const [{ data: messages }, { data: requests }, { data: comments }] = await Promise.all([
    supabase.from("group_messages").select("id, body, profile_id, groups(name)").in("id", ids("group_message")),
    supabase.from("prayer_requests").select("id, body, is_anonymous, visibility").in("id", ids("prayer_request")),
    supabase.from("prayer_interactions").select("id, body, profile_id").in("id", ids("prayer_comment")),
  ]);
  const personIds = [
    ...(reports ?? []).map((r) => r.reporter_id),
    ...(messages ?? []).map((m) => m.profile_id),
    ...(comments ?? []).map((c) => c.profile_id),
    ...(blocks ?? []).flatMap((b) => [b.blocker_id, b.blocked_id]),
  ];
  const { data: people } = personIds.length
    ? await supabase.from("profiles").select("id, full_name").in("id", [...new Set(personIds)])
    : { data: [] };
  const name = (id: string | null | undefined) => (people ?? []).find((p) => p.id === id)?.full_name ?? "Unknown";
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const content = (r: NonNullable<typeof reports>[number]) => {
    if (r.target_type === "group_message") {
      const m = messages?.find((x) => x.id === r.target_id);
      return m ? { body: m.body, by: `${name(m.profile_id)}, in ${m.groups?.name ?? "a group"}` } : null;
    }
    if (r.target_type === "prayer_comment") {
      const c = comments?.find((x) => x.id === r.target_id);
      return c ? { body: c.body ?? "", by: name(c.profile_id) } : null;
    }
    const p = requests?.find((x) => x.id === r.target_id);
    return p ? { body: p.body, by: p.is_anonymous ? "Anonymous (the author stays hidden)" : "Author hidden in reports", scope: p.visibility } : null;
  };

  return (
    <>
      <PageTitle sub="You see a reported post only while its report is open. Nothing else from any chat or prayer wall.">
        Reports
      </PageTitle>
      <Flash error={error} notice={notice} />

      <Section title={`Open (${reports?.length ?? 0})`}>
        {(reports ?? []).length === 0 ? <p className="text-sm text-neutral-500">Nothing to review.</p> : null}
        <ul className="flex flex-col gap-4">
          {(reports ?? []).map((r) => {
            const c = content(r);
            return (
              <li key={r.id} className="rounded-lg border border-neutral-300 p-4 dark:border-navy">
                <p className="text-sm text-neutral-500">
                  {TYPE_LABEL[r.target_type]}, reported by {name(r.reporter_id)} on {when(r.created_at)}
                  {r.reason ? `: "${r.reason}"` : ""}
                </p>
                {c ? (
                  <>
                    <blockquote className="my-3 border-l-4 border-gold pl-3 whitespace-pre-wrap">{c.body}</blockquote>
                    <p className="mb-3 text-sm text-neutral-500">{c.by}</p>
                  </>
                ) : (
                  <p className="my-3 text-sm text-neutral-500">Already removed by its author.</p>
                )}
                <div className="flex gap-3">
                  <form action={resolveReport}>
                    <input type="hidden" name="report_id" value={r.id} />
                    <input type="hidden" name="remove" value="false" />
                    <Submit variant="secondary">Dismiss</Submit>
                  </form>
                  <form action={resolveReport}>
                    <input type="hidden" name="report_id" value={r.id} />
                    <input type="hidden" name="remove" value="true" />
                    <Submit variant="danger">Remove it</Submit>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Recent blocks">
        <p className="mb-2 text-sm text-neutral-500">A man blocked another. You see who, never what was said.</p>
        <ul className="text-sm">
          {(blocks ?? []).map((b, i) => (
            <li key={i}>{when(b.created_at)}: {name(b.blocker_id)} blocked {name(b.blocked_id)}</li>
          ))}
          {(blocks ?? []).length === 0 ? <li className="text-neutral-500">None.</li> : null}
        </ul>
      </Section>
    </>
  );
}
