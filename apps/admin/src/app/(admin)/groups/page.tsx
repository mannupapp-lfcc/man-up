import Link from "next/link";
import { Flash, PageTitle, Section, Submit, formatTime } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { createGroup } from "./actions";
import { GroupFields } from "./GroupFields";

export default async function GroupsPage({ searchParams }: PageProps<"/groups">) {
  const { error } = await searchParams;
  const { supabase, ministryId } = await requireAdmin();

  const [{ data: groups }, { data: members }, { data: placed }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, status, meeting_day, meeting_time, group_members(is_group_leader, left_at, profiles(full_name))")
      .eq("ministry_id", ministryId)
      .order("status")
      .order("name"),
    supabase.from("ministry_members").select("profile_id").eq("ministry_id", ministryId).is("left_at", null),
    supabase.from("group_members").select("profile_id").eq("ministry_id", ministryId).is("left_at", null),
  ]);
  const placedIds = new Set((placed ?? []).map((p) => p.profile_id));
  const unplaced = (members ?? []).filter((m) => !placedIds.has(m.profile_id)).length;

  return (
    <>
      <PageTitle sub="Groups of 4 to 8 men. Active groups get their meetings scheduled 4 weeks ahead.">Groups</PageTitle>
      <Flash error={error} />

      <dl className="stats-grid">
        <div className="stat-card"><dt>Active groups</dt><dd>{(groups ?? []).filter((g) => g.status === "active").length}</dd><p>Making room for brotherhood</p></div>
        <div className="stat-card"><dt>Ministry members</dt><dd>{members?.length ?? 0}</dd><p>Every man matters</p></div>
        <div className="stat-card attention"><dt>Awaiting a group</dt><dd>{unplaced}</dd><p>Your next opportunity to connect</p></div>
      </dl>

      {unplaced > 0 ? (
        <p className="mb-6 text-sm">
          <Link href="/people?show=unplaced" className="font-medium text-navy hover:underline dark:text-gold">
            {unplaced} {unplaced === 1 ? "man is" : "men are"} not in a group yet
          </Link>
        </p>
      ) : null}

      <Section title="All groups">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr><th className="py-2 pr-4">Group</th><th className="pr-4">Meets</th><th className="pr-4">Leaders</th><th className="pr-4">Men</th><th>Status</th></tr>
            </thead>
            <tbody>
              {groups?.length === 0 ? <tr><td colSpan={5}>No groups yet. Create your first group below to get started.</td></tr> : null}
              {(groups ?? []).map((g) => {
                const active = g.group_members.filter((m) => !m.left_at);
                const leaders = active.filter((m) => m.is_group_leader).map((m) => m.profiles?.full_name).join(", ");
                return (
                  <tr key={g.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-2 pr-4">
                      <Link href={`/groups/${g.id}`} className="font-medium text-navy hover:underline dark:text-gold">{g.name}</Link>
                    </td>
                    <td className="pr-4">{g.meeting_day ? `${g.meeting_day} ${formatTime(g.meeting_time)}` : "Not set"}</td>
                    <td className="pr-4">{leaders || <span className="text-amber-700 dark:text-amber-400">None yet</span>}</td>
                    <td className="pr-4">{active.length}</td>
                    <td><span className="status-badge" data-status={g.status}>{g.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="New group">
        <form action={createGroup} className="flex flex-col gap-4">
          <GroupFields />
          <div><Submit>Create group</Submit></div>
        </form>
      </Section>
    </>
  );
}
