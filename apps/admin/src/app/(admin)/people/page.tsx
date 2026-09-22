import Link from "next/link";
import { Flash, PageTitle, ROLE_LABEL, Submit, daysAgo, inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { placeMember } from "../groups/actions";
import { changeRole } from "./actions";

export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  const { error, show, q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const onlyUnplaced = show === "unplaced";
  const back = onlyUnplaced ? "/people?show=unplaced" : "/people";
  const { supabase, ministryId, userId } = await requireAdmin();

  const [{ data: people }, { data: placements }, { data: groups }] = await Promise.all([
    supabase
      .from("ministry_members")
      .select("profile_id, role, joined_at, profiles(full_name, email, phone, pco_person_id)")
      .eq("ministry_id", ministryId)
      .is("left_at", null),
    supabase
      .from("group_members")
      .select("profile_id, groups(name)")
      .eq("ministry_id", ministryId)
      .is("left_at", null),
    supabase.from("groups").select("id, name").eq("ministry_id", ministryId).neq("status", "archived").order("name"),
  ]);
  const groupOf = new Map((placements ?? []).map((p) => [p.profile_id, p.groups?.name ?? null]));
  const rows = (people ?? [])
    .map((p) => ({ ...p, group: groupOf.get(p.profile_id) ?? null }))
    .filter((p) => !onlyUnplaced || !p.group)
    .filter((p) => !query || [p.profiles?.full_name, p.profiles?.email, p.profiles?.phone].some((value) => value?.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => (a.profiles?.full_name ?? "").localeCompare(b.profiles?.full_name ?? ""));

  return (
    <>
      <PageTitle sub={onlyUnplaced ? "Men who joined but are not in a group yet. Getting them placed fast matters most." : `${rows.length} men in the ministry`}>
        {onlyUnplaced ? "Not in a group" : "People"}
      </PageTitle>
      <p className="mb-4 flex gap-4 text-sm">
        <Link href="/people" className={onlyUnplaced ? "text-navy hover:underline dark:text-gold" : "font-semibold"}>Everyone</Link>
        <Link href="/people?show=unplaced" className={onlyUnplaced ? "font-semibold" : "text-navy hover:underline dark:text-gold"}>Not in a group</Link>
      </p>
      <form action="/people" method="get" className="people-search">
        {onlyUnplaced ? <input type="hidden" name="show" value="unplaced" /> : null}
        <label htmlFor="people-search" className="sr-only">Search people by name, email, or phone</label>
        <input id="people-search" name="q" type="search" defaultValue={query} placeholder="Search by name, email, or phone…" className={inputClass} />
        <Submit variant="secondary">Search</Submit>
        {query ? <Link href={back} className="text-sm underline">Clear</Link> : null}
      </form>
      <Flash error={error} />

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr><th className="py-2 pr-4">Name</th><th className="pr-4">Contact</th><th className="pr-4">Group</th><th className="pr-4">Role</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={4}>No members match this view. Try another search or choose Everyone.</td></tr> : null}
            {rows.map((p) => (
              <tr key={p.profile_id} className="border-t border-neutral-200 align-top dark:border-neutral-800">
                <td className="py-2 pr-4">
                  <div className="font-medium">{p.profiles?.full_name}</div>
                  <div className="text-xs text-neutral-500">
                    Joined {daysAgo(p.joined_at)} days ago{p.profiles?.pco_person_id ? "" : ", not matched to PCO"}
                  </div>
                </td>
                <td className="py-2 pr-4">
                  <div>{p.profiles?.email}</div>
                  <div className="text-neutral-500">{p.profiles?.phone}</div>
                </td>
                <td className="py-2 pr-4">
                  {p.group ?? (
                    <form action={placeMember} className="flex gap-2">
                      <input type="hidden" name="profile_id" value={p.profile_id} />
                      <input type="hidden" name="back" value={back} />
                      <select name="group_id" required defaultValue="" className={inputClass}>
                        <option value="" disabled>Choose a group</option>
                        {(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                      <Submit variant="secondary">Place</Submit>
                    </form>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {p.profile_id === userId ? (
                    ROLE_LABEL[p.role]
                  ) : (
                    <form action={changeRole} className="flex gap-2">
                      <input type="hidden" name="profile_id" value={p.profile_id} />
                      <input type="hidden" name="back" value={back} />
                      <select name="role" defaultValue={p.role} className={inputClass}>
                        {Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <Submit variant="secondary">Save</Submit>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="mt-4 text-sm text-neutral-500">{onlyUnplaced ? "Everyone is in a group." : "No one yet."}</p> : null}
      </div>
    </>
  );
}
