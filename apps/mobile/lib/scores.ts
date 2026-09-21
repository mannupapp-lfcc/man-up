import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { colors } from "./theme";
import { supabase } from "./supabase";

export type Tier = "New" | "Thriving" | "Steady" | "Drifting" | "Disconnected";
export type ManTier = { profileId: string; tier: Tier; trend: "up" | "flat" | "down" | null; velocity: boolean; isNew: boolean; paused: boolean };

export const TIER_COLOR: Record<Tier, string> = {
  New: colors.muted,
  Thriving: colors.thriving,
  Steady: colors.steady,
  Drifting: colors.drifting,
  Disconnected: colors.disconnected,
};

// What a leader sees next to each tier (scoring plan section 3).
export const TIER_HINT: Record<Tier, string> = {
  New: "New: no tier for the first 30 days",
  Thriving: "Engaged and consistent",
  Steady: "Connected",
  Drifting: "Worth a check-in",
  Disconnected: "Needs a call",
};

export const TREND_WORD = { up: "trending up", flat: "", down: "trending down" } as const;

// Leaders read tiers only (group_tiers()); numbers never reach the phone.
export function useGroupTiers(groupId: string | null) {
  const [tiers, setTiers] = useState<Map<string, ManTier> | null>(null);
  const load = useCallback(async () => {
    if (!groupId) return;
    const { data } = await supabase.rpc("group_tiers", { p_group: groupId });
    setTiers(new Map((data ?? []).map((r) => [r.profile_id, {
      profileId: r.profile_id, tier: r.tier as Tier, trend: (r.trend as ManTier["trend"]) ?? null,
      velocity: r.velocity_alert, isNew: r.is_new, paused: r.paused,
    }])));
  }, [groupId]);
  useFocusEffect(useCallback(() => void load(), [load]));
  return { tiers, reload: load };
}
