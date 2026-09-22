import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Card, Loading, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors } from "@/lib/theme";

type Components = Record<string, { earned: number; max: number; applicable: boolean }>;
type GroupRow = { group_id: string; as_of: string; band: string; components: Components; triggers: string[] };
type LeaderRow = { profile_id: string; group_id: string | null; as_of: string; tier: string | null };
type Unplaced = { profileId: string; fullName: string; joinedAt: string; days: number };

const BAND_COLOR: Record<string, string> = { Healthy: colors.thriving, Watch: colors.drifting, "At Risk": colors.disconnected };
const BAND_ORDER: Record<string, number> = { "At Risk": 0, Watch: 1, Healthy: 2 };
const TIER_COLOR: Record<string, string> = { Consistent: colors.thriving, Inconsistent: colors.drifting, Inactive: colors.disconnected };
const TIER_ORDER: Record<string, number> = { Inactive: 0, Inconsistent: 1, Consistent: 2 };
const COMPONENT_LABEL: Record<string, string> = {
  engagement: "member engagement", attendance: "attendance rate", meetings: "meeting consistency",
  spread: "participation spread", stability: "roster stability",
};

// The weakest applicable component, same rule as the admin web Health page.
function weakest(components: Components) {
  const list = Object.entries(components ?? {}).filter(([, c]) => c.applicable && c.max > 0);
  if (!list.length) return null;
  const [key] = list.sort((a, b) => a[1].earned / a[1].max - b[1].earned / b[1].max)[0]!;
  return COMPONENT_LABEL[key] ?? key;
}

// Keep only the newest row per key (rows arrive newest first).
function latest<T extends { as_of: string }>(rows: T[], key: (r: T) => string) {
  const seen = new Map<string, T>();
  for (const r of rows) if (!seen.has(key(r))) seen.set(key(r), r);
  return [...seen.values()];
}

// Ministry admin on the phone (product map section 5): place men who are not in a
// group yet, and a glanceable health board. Bands and tiers only; numbers, weights,
// and season flags live on the admin website.
export default function MinistryAdmin() {
  const c = useColors();
  const { state } = useAuth();
  const ministryId = state.status === "ready" ? state.membership.ministryId : null;
  const [data, setData] = useState<{
    groups: GroupRow[]; leaders: LeaderRow[]; groupName: Map<string, string>; name: Map<string, string>;
    unplaced: Unplaced[]; openGroups: { id: string; name: string }[];
  } | null>(null);
  const [placing, setPlacing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ministryId) return;
    const [groupScores, leaderScores, groups, people, members, placements] = await Promise.all([
      supabase.from("group_scores").select("group_id, as_of, band, components, triggers").eq("ministry_id", ministryId).order("as_of", { ascending: false }).limit(500),
      supabase.from("leader_scores").select("profile_id, group_id, as_of, tier").eq("ministry_id", ministryId).order("as_of", { ascending: false }).limit(500),
      supabase.from("groups").select("id, name, status").eq("ministry_id", ministryId).order("name"),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("ministry_members").select("profile_id, joined_at, profiles(full_name)").eq("ministry_id", ministryId).is("left_at", null),
      supabase.from("group_members").select("profile_id").eq("ministry_id", ministryId).is("left_at", null),
    ]);
    const placed = new Set((placements.data ?? []).map((p) => p.profile_id));
    const now = Date.now();
    setData({
      groups: latest((groupScores.data ?? []) as GroupRow[], (r) => r.group_id)
        .sort((a, b) => (BAND_ORDER[a.band] ?? 3) - (BAND_ORDER[b.band] ?? 3)),
      leaders: latest((leaderScores.data ?? []) as LeaderRow[], (r) => r.profile_id)
        .sort((a, b) => (TIER_ORDER[a.tier ?? ""] ?? 3) - (TIER_ORDER[b.tier ?? ""] ?? 3)),
      groupName: new Map((groups.data ?? []).map((g) => [g.id, g.name])),
      name: new Map((people.data ?? []).map((p) => [p.id, p.full_name])),
      unplaced: (members.data ?? [])
        .filter((m) => !placed.has(m.profile_id))
        .map((m) => ({ profileId: m.profile_id, fullName: m.profiles?.full_name ?? "", joinedAt: m.joined_at,
          days: Math.floor((now - new Date(m.joined_at).getTime()) / 86_400_000) }))
        .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)),
      openGroups: (groups.data ?? []).filter((g) => g.status !== "archived"),
    });
  }, [ministryId]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const place = async (man: Unplaced, group: { id: string; name: string }) => {
    const { error } = await supabase.rpc("place_member", { p_group: group.id, p_profile: man.profileId });
    if (error) return Alert.alert("Not placed", error.message);
    setPlacing(null);
    void load();
  };

  if (!data) return <Loading />;
  const asOf = data.groups[0]?.as_of ?? data.leaders[0]?.as_of;

  return (
    <Screen>
      <Card title={data.unplaced.length ? `Not in a group (${data.unplaced.length})` : "Not in a group"}>
        {data.unplaced.length === 0 ? <Body muted>Everyone is in a group.</Body> : null}
        {data.unplaced.map((m) => {
          const open = placing === m.profileId;
          return (
            <View key={m.profileId} style={styles.placeRow}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{m.fullName}</Text>
                  <Text style={{ color: c.muted, fontSize: 13 }}>Joined {m.days === 0 ? "today" : `${m.days} ${m.days === 1 ? "day" : "days"} ago`}</Text>
                </View>
                <Chip label={open ? "Cancel" : "Place"} onPress={() => setPlacing(open ? null : m.profileId)} />
              </View>
              {open ? (
                <View style={styles.chips}>
                  {data.openGroups.length === 0 ? <Body muted>No groups yet. Create one on the admin website.</Body> : null}
                  {data.openGroups.map((g) => <Chip key={g.id} label={g.name} onPress={() => void place(m, g)} />)}
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Body muted>
        {asOf
          ? `Scores as of ${new Date(`${asOf}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric" })}. Recomputed every Sunday night.`
          : "No scores yet. They are computed every Sunday night."}
      </Body>

      <Card title="Groups">
        {data.groups.length === 0 ? <Body muted>No group scores yet.</Body> : null}
        {data.groups.map((g) => {
          const weak = g.band !== "Healthy" ? weakest(g.components) : null;
          const triggers = Array.isArray(g.triggers) ? g.triggers : [];
          return (
            <View key={g.group_id} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: BAND_COLOR[g.band] ?? c.border }]} />
              <View style={styles.flex}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{data.groupName.get(g.group_id) ?? "Group"}</Text>
                <Text style={{ color: BAND_COLOR[g.band] ?? c.muted, fontSize: 13 }}>{g.band}</Text>
                {triggers.map((t) => <Text key={t} style={{ color: c.error, fontSize: 13 }}>{t}</Text>)}
                {weak ? <Text style={{ color: c.muted, fontSize: 13 }}>Weakest: {weak}</Text> : null}
              </View>
            </View>
          );
        })}
      </Card>

      <Card title="Leader consistency">
        <Body muted>A low tier usually means the leader needs support, not correction.</Body>
        {data.leaders.length === 0 ? <Body muted>No leader scores yet.</Body> : null}
        {data.leaders.map((l) => (
          <View key={l.profile_id} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: TIER_COLOR[l.tier ?? ""] ?? c.border }]} />
            <View style={styles.flex}>
              <Text style={{ color: c.text, fontSize: 16 }}>{data.name.get(l.profile_id) ?? "Leader"}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>
                {l.tier ?? "Not scored"}{l.group_id && data.groupName.get(l.group_id) ? `, ${data.groupName.get(l.group_id)}` : ""}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      <Body muted>Weights, season flags, and everything else are on the admin website.</Body>
    </Screen>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, { borderColor: c.accent }]}>
      <Text style={{ color: c.accent, fontSize: 14, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 },
  flex: { flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 5 },
  placeRow: { paddingBottom: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minHeight: 40, justifyContent: "center" },
});
