import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export type Gathering = {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  canceled: boolean;
  churchCenterUrl: string | null;
};

type State = { status: "loading" } | { status: "error" } | { status: "ready"; upcoming: Gathering[]; recent: Gathering[] };

// Gatherings mirror the ministry's PCO group events (synced nightly, read-only).
export function useGatherings() {
  const { state: auth } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });
  const ministryId = auth.status === "ready" ? auth.membership.ministryId : null;

  const load = useCallback(async () => {
    if (!ministryId) return;
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("gatherings")
      .select("id, title, gathering_at, ends_at, location, canceled, church_center_url")
      .eq("ministry_id", ministryId)
      .gte("gathering_at", since)
      .order("gathering_at")
      .limit(40);
    if (error) return setState({ status: "error" });
    const now = Date.now();
    const all: Gathering[] = data.map((g) => ({
      id: g.id,
      title: g.title,
      startsAt: new Date(g.gathering_at),
      endsAt: g.ends_at ? new Date(g.ends_at) : null,
      location: g.location,
      canceled: g.canceled,
      churchCenterUrl: g.church_center_url,
    }));
    // A gathering stays "upcoming" until it ends (or 3 hours after it starts).
    const over = (g: Gathering) => (g.endsAt ?? new Date(g.startsAt.getTime() + 3 * 3_600_000)).getTime() < now;
    setState({ status: "ready", upcoming: all.filter((g) => !over(g)), recent: all.filter(over).reverse().slice(0, 5) });
  }, [ministryId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { state, reload: load };
}

export function nextGathering(list: Gathering[]) {
  return list.find((g) => !g.canceled);
}

export function formatGathering(g: Gathering) {
  const date = g.startsAt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const time = g.startsAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}
