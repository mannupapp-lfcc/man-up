import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "./auth";
import { useMyGroup } from "./group";
import { supabase } from "./supabase";

export type Opportunity = {
  id: string;
  title: string;
  description: string | null;
  when: string | null;
  url: string | null;
  open: boolean;
};

export type Claim = {
  id: string;
  opportunityId: string;
  confirmedAt: string | null;
  optedIn: string[]; // profile ids
};

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; opportunities: Opportunity[]; claims: Map<string, Claim>; myServeCount: number };

// Serve opportunities mirror the PCO Registrations sign-ups admins pick. Sign-up
// itself happens on Church Center; the app links out.
export function useServe() {
  const { state: auth } = useAuth();
  const { state: group } = useMyGroup();
  const [state, setState] = useState<State>({ status: "loading" });
  const me = auth.status === "ready" ? auth.session.user.id : null;
  const groupId = group.status === "ready" ? group.group?.groupId ?? null : null;

  const load = useCallback(async () => {
    if (!me) return;
    const [opps, claims, logs] = await Promise.all([
      supabase
        .from("serve_opportunities")
        .select("id, title, description, when_text, church_center_url, registration_open")
        .eq("active", true)
        .order("title"),
      groupId
        ? supabase.from("serve_claims").select("id, opportunity_id, confirmed_at, serve_claim_optins(profile_id)").eq("group_id", groupId)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("serve_logs").select("id", { count: "exact", head: true }).eq("profile_id", me),
    ]);
    if (opps.error || claims.error) return setState({ status: "error" });
    setState({
      status: "ready",
      opportunities: opps.data.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        when: o.when_text,
        url: o.church_center_url,
        open: o.registration_open,
      })),
      claims: new Map(
        (claims.data ?? []).map((c) => [
          c.opportunity_id,
          { id: c.id, opportunityId: c.opportunity_id, confirmedAt: c.confirmed_at, optedIn: c.serve_claim_optins.map((o) => o.profile_id) },
        ]),
      ),
      myServeCount: logs.count ?? 0,
    });
  }, [me, groupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { state, reload: load, group: group.status === "ready" ? group.group : null };
}

export async function claimForGroup(ministryId: string, groupId: string, opportunityId: string, me: string) {
  const { error } = await supabase
    .from("serve_claims")
    .insert({ ministry_id: ministryId, group_id: groupId, opportunity_id: opportunityId, claimed_by: me });
  return error?.message ?? null;
}

export async function unclaim(claimId: string) {
  const { error } = await supabase.from("serve_claims").delete().eq("id", claimId);
  return error?.message ?? null;
}

export async function setOptIn(ministryId: string, claimId: string, me: string, on: boolean) {
  const { error } = on
    ? await supabase.from("serve_claim_optins").insert({ ministry_id: ministryId, claim_id: claimId, profile_id: me })
    : await supabase.from("serve_claim_optins").delete().eq("claim_id", claimId).eq("profile_id", me);
  return error?.message ?? null;
}

export async function confirmServed(claimId: string, served: string[], servedOn: string) {
  const { error } = await supabase.rpc("confirm_group_serve", { p_claim: claimId, p_served: served, p_served_on: servedOn });
  return error?.message ?? null;
}
