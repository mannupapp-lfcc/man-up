import { Flash, Label, PageTitle, ROLE_LABEL, Section, Submit, inputClass, isPast } from "@/components/ui";
import { requireAdmin } from "@/lib/admin";
import { createInvite, revokeInvite } from "./actions";

export default async function InvitesPage({ searchParams }: PageProps<"/invites">) {
  const { error, notice } = await searchParams;
  const { supabase, ministryId } = await requireAdmin();
  const { data: codes } = await supabase
    .from("invite_codes")
    .select("id, code, role_granted, uses, max_uses, expires_at, revoked_at, created_at")
    .eq("ministry_id", ministryId)
    .order("created_at", { ascending: false });

  const stateOf = (c: NonNullable<typeof codes>[number]) =>
    c.revoked_at ? "Revoked"
      : isPast(c.expires_at) ? "Expired"
      : c.max_uses !== null && c.uses >= c.max_uses ? "Used up"
      : "Active";

  return (
    <>
      <PageTitle sub="Anyone can sign up as a member. A code gives a man a leader role when he signs up, or promotes him if he already has an account.">
        Invite codes
      </PageTitle>
      <Flash error={error} notice={notice} />

      <Section title="New code">
        <form action={createInvite} className="flex flex-wrap items-end gap-4">
          <Label text="Gives role">
            <select name="role" defaultValue="co_leader" className={inputClass}>
              <option value="co_leader">Co-leader</option>
              <option value="leader">Leader</option>
              <option value="admin">Admin</option>
            </select>
          </Label>
          <Label text="Uses (blank = unlimited)">
            <input name="max_uses" type="number" min={1} defaultValue={1} className={inputClass} />
          </Label>
          <Label text="Expires in days (blank = never)">
            <input name="expires_days" type="number" min={1} defaultValue={14} className={inputClass} />
          </Label>
          <Submit>Create code</Submit>
        </form>
      </Section>

      <Section title="Codes">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr><th className="py-2 pr-4">Code</th><th className="pr-4">Role</th><th className="pr-4">Used</th><th className="pr-4">Expires</th><th className="pr-4">State</th><th /></tr>
            </thead>
            <tbody>
              {(codes ?? []).map((c) => {
                const state = stateOf(c);
                return (
                  <tr key={c.id} className="border-t border-neutral-200 dark:border-neutral-800">
                    <td className="py-2 pr-4 font-mono">{c.code}</td>
                    <td className="pr-4">{ROLE_LABEL[c.role_granted]}</td>
                    <td className="pr-4">{c.uses}{c.max_uses !== null ? ` of ${c.max_uses}` : ""}</td>
                    <td className="pr-4">{c.expires_at ? new Date(c.expires_at).toLocaleDateString("en-US") : "Never"}</td>
                    <td className="pr-4">{state}</td>
                    <td className="py-2">
                      {state === "Active" ? (
                        <form action={revokeInvite}>
                          <input type="hidden" name="id" value={c.id} />
                          <Submit variant="danger">Revoke</Submit>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
