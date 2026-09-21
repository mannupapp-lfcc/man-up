import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash, PageTitle, ROLE_LABEL, Section, Submit, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { clearLeader, placeMember, removeFromGroup, setLeader, updateGroup } from "../actions";
import { GroupFields } from "../GroupFields";

export default async function GroupPage({ params, searchParams }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  const { error, notice } = await searchParams;
  const { supabase, ministryId, timeZone } = await requireAdmin();

  const [{ data: group }, { data: people }, { data: placements }, { data: meetings }] = await Promise.all([
    supabase.from("groups").select("id, name, status, meeting_day, meeting_time").eq("id", id).eq("ministry_id", ministryId).maybeSingle(),
    supabase
      .from("ministry_members")
      .select("profile_id, role, profiles(full_name)")
      .eq("ministry_id", ministryId)
      .is("left_at", null),
    supabase
      .from("group_members")
      .select("group_id, profile_id, is_group_leader, groups(name)")
      .eq("ministry_id", ministryId)
      .is("left_at", null),
    supabase
      .from("meetings")
      .select("id, meeting_at, attendance_marked_at")
      .eq("group_id", id)
      .gte("meeting_at", new Date().toISOString())
      .order("meeting_at")
      .limit(4),
  ]);
  if (!group) notFound();

  const byProfile = new Map((placements ?? []).map((p) => [p.profile_id, p]));
  const roster = (people ?? [])
    .filter((p) => byProfile.get(p.profile_id)?.group_id === id)
    .map((p) => ({ ...p, leads: byProfile.get(p.profile_id)?.is_group_leader ?? false }))
    .sort((a, b) => Number(b.leads) - Number(a.leads) || (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? ""));
  const others = (people ?? [])
    .filter((p) => byProfile.get(p.profile_id)?.group_id !== id)
    .map((p) => ({ ...p, current: byProfile.get(p.profile_id)?.groups?.name ?? null }))
    .sort((a, b) => Number(!!a.current) - Number(!!b.current) || (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? ""));

  return (
    <>
      <p className="mb-2 text-sm"><Link href="/groups" className="text-blue-700 hover:underline dark:text-blue-400">All groups</Link></p>
      <PageTitle sub={`${roster.length} ${roster.length === 1 ? "man" : "men"}`}>{group.name}</PageTitle>
      <Flash error={error} notice={notice} />

      <Section title="Men in this group">
        {roster.length === 0 ? <p className="text-sm text-neutral-500">No one yet. Add men below.</p> : null}
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {roster.map((m) => (
            <li key={m.profile_id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="min-w-48 flex-1">
                <span className="font-medium">{m.profiles?.full_name}</span>
                <span className="ml-2 text-sm text-neutral-500">{ROLE_LABEL[m.role]}{m.leads ? ", leads this group" : ""}</span>
              </span>
              {m.leads ? (
                <form action={clearLeader}>
                  <input type="hidden" name="group_id" value={id} />
                  <input type="hidden" name="profile_id" value={m.profile_id} />
                  <Submit variant="secondary">Stop leading</Submit>
                </form>
              ) : (
                <>
                  <form action={setLeader}>
                    <input type="hidden" name="group_id" value={id} />
                    <input type="hidden" name="profile_id" value={m.profile_id} />
                    <input type="hidden" name="role" value="co_leader" />
                    <Submit variant="secondary">Make co-leader</Submit>
                  </form>
                  <form action={setLeader}>
                    <input type="hidden" name="group_id" value={id} />
                    <input type="hidden" name="profile_id" value={m.profile_id} />
                    <input type="hidden" name="role" value="leader" />
                    <Submit variant="secondary">Make leader</Submit>
                  </form>
                </>
              )}
              <form action={removeFromGroup}>
                <input type="hidden" name="group_id" value={id} />
                <input type="hidden" name="profile_id" value={m.profile_id} />
                <Submit variant="danger">Remove</Submit>
              </form>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Add a man">
        <form action={placeMember} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="group_id" value={id} />
          <select name="profile_id" required className={inputClass} defaultValue="">
            <option value="" disabled>Choose a man</option>
            {others.map((p) => (
              <option key={p.profile_id} value={p.profile_id}>
                {p.profiles?.full_name}{p.current ? ` (moves from ${p.current})` : " (not in a group)"}
              </option>
            ))}
          </select>
          <Submit>Add to group</Submit>
        </form>
      </Section>

      <Section title="Schedule">
        <form action={updateGroup} className="flex flex-col gap-4">
          <input type="hidden" name="group_id" value={id} />
          <GroupFields values={group} />
          <div><Submit>Save</Submit></div>
        </form>
        <p className="mt-4 text-sm text-neutral-500">
          Next meetings: {meetings?.length
            ? meetings.map((m) => new Date(m.meeting_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone })).join(", ")
            : "none scheduled (set a day, time, and Active status)"}
        </p>
      </Section>
    </>
  );
}
