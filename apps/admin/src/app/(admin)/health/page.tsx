import Link from "next/link";
import { Flash, PageTitle, Section, Submit } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { endSeasonFlag, runScoringNow } from "./actions";

type Components = Record<string, { earned: number; max: number; applicable: boolean }>;

const COMPONENT_LABEL: Record<string, string> = {
  engagement: "member engagement", attendance: "attendance rate", meetings: "meeting consistency",
  spread: "participation spread", stability: "roster stability",
  coverage: "contact coverage", followthrough: "Needs a Call follow-through", personal: "his own engagement",
};
const BAND_STYLE: Record<string, string> = {
  Healthy: "border-green-600 bg-green-50 dark:bg-green-950",
  Watch: "border-gold bg-amber-50 dark:bg-amber-950",
  "At Risk": "border-red-600 bg-red-50 dark:bg-red-950",
};

// The weakest applicable component, named for the monthly review (scoring plan 5).
function weakest(components: Components) {
  const list = Object.entries(components).filter(([, c]) => c.applicable && c.max > 0);
  if (!list.length) return null;
  const [key] = list.sort((a, b) => a[1].earned / a[1].max - b[1].earned / b[1].max)[0]!;
  return COMPONENT_LABEL[key] ?? key;
}

export default async function HealthPage({ searchParams }: PageProps<"/health">) {
  const { error, notice } = await searchParams;
  const { supabase, ministryId, timeZone } = await requireAdmin();

  const [groupScores, leaderScores, groups, people, flags] = await Promise.all([
    supabase.from("group_scores").select("group_id, as_of, total, band, components, triggers").eq("ministry_id", ministryId).order("as_of", { ascending: false }).limit(500),
    supabase.from("leader_scores").select("profile_id, group_id, as_of, total, tier, components").eq("ministry_id", ministryId).order("as_of", { ascending: false }).limit(500),
    supabase.from("groups").select("id, name").eq("ministry_id", ministryId),
    supabase.from("profiles").select("id, full_name"),
    supabase.from("season_flags").select("id, profile_id, ends_on").eq("ministry_id", ministryId).gte("ends_on", new Date().toISOString().slice(0, 10)),
  ]);
  const latest = <T extends { as_of: string }>(rows: T[], key: (r: T) => string) => {
    const seen = new Map<string, T>();
    for (const r of rows) if (!seen.has(key(r))) seen.set(key(r), r);
    return [...seen.values()];
  };
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const name = new Map((people.data ?? []).map((p) => [p.id, p.full_name]));
  const bandOrder: Record<string, number> = { "At Risk": 0, Watch: 1, Healthy: 2 };
  const board = latest(groupScores.data ?? [], (r) => r.group_id).sort((a, b) => (bandOrder[a.band] ?? 3) - (bandOrder[b.band] ?? 3));
  const leaders = latest(leaderScores.data ?? [], (r) => r.profile_id).sort((a, b) => Number(a.total) - Number(b.total));
  const asOf = board[0]?.as_of ?? leaders[0]?.as_of;

  return (
    <>
      <PageTitle sub={asOf ? `Scores as of ${new Date(`${asOf}T12:00:00`).toLocaleDateString("en-US", { timeZone, month: "long", day: "numeric" })}. Recomputed every Sunday night.` : "No scores yet. They are computed every Sunday night."}>
        Group health
      </PageTitle>
      <Flash error={error} notice={notice} />
      <form action={runScoringNow} className="mb-6"><Submit variant="secondary">Run scoring now</Submit></form>

      <dl className="stats-grid">
        <div className="stat-card"><dt>Healthy groups</dt><dd>{board.filter((g) => g.band === "Healthy").length}</dd><p>Building a steady rhythm</p></div>
        <div className="stat-card attention"><dt>Groups needing attention</dt><dd>{board.filter((g) => g.band !== "Healthy").length}</dd><p>A conversation can make a difference</p></div>
        <div className="stat-card"><dt>Season-of-life flags</dt><dd>{flags.data?.length ?? 0}</dd><p>Space for a difficult season</p></div>
      </dl>
      <Section title="Groups">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {board.map((g) => {
            const triggers = Array.isArray(g.triggers) ? (g.triggers as string[]) : [];
            const weak = weakest(g.components as Components);
            return (
              <div key={g.group_id} className={`rounded-lg border-l-4 p-4 ${BAND_STYLE[g.band] ?? ""}`}>
                <p className="font-semibold">{groupName.get(g.group_id) ?? "Group"}</p>
                <div className="health-score"><span className="status-badge">{g.band}</span><strong>{Math.round(Number(g.total))}<small>/100</small></strong></div>
                {triggers.map((tr) => <p key={tr} className="text-sm text-red-700 dark:text-red-300">{tr}</p>)}
                {weak && g.band !== "Healthy" ? <p className="text-sm text-neutral-500">Weakest: {weak}</p> : null}
              </div>
            );
          })}
          {board.length === 0 ? <p className="text-sm text-neutral-500">No group scores yet.</p> : null}
        </div>
      </Section>

      <Section title="Leader consistency">
        <p className="mb-2 text-sm text-neutral-500">Admins only. Framed as consistency, never performance: a low tier usually means the leader needs support.</p>
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500"><tr><th className="py-2 pr-4">Leader</th><th className="pr-4">Group</th><th className="pr-4">Tier</th><th>Weakest</th></tr></thead>
          <tbody>
            {leaders.map((l) => (
              <tr key={l.profile_id} className="border-t border-neutral-200 dark:border-neutral-800">
                <td className="py-2 pr-4">{name.get(l.profile_id)}</td>
                <td className="pr-4">{l.group_id ? groupName.get(l.group_id) : ""}</td>
                <td className="pr-4">{l.tier} ({Math.round(Number(l.total))})</td>
                <td>{weakest(l.components as Components) ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={`Season-of-life flags (${flags.data?.length ?? 0})`}>
        <p className="mb-2 text-sm text-neutral-500">Set by group leaders; alerts are paused until the end date.</p>
        <ul className="text-sm">
          {(flags.data ?? []).map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-1">
              <span className="flex-1">{name.get(f.profile_id)} until {new Date(`${f.ends_on}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              <form action={endSeasonFlag}><input type="hidden" name="id" value={f.id} /><Submit variant="secondary">End now</Submit></form>
            </li>
          ))}
        </ul>
      </Section>
      <p className="text-sm"><Link href="/scoring" className="text-navy hover:underline dark:text-gold">Tune scoring weights</Link></p>
    </>
  );
}
