import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Body, Card, Loading, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatMeeting, useGroup } from "@/lib/group";
import { timeAgo } from "@/lib/pray";
import { TIER_COLOR, TIER_HINT, TREND_WORD, useGroupTiers } from "@/lib/scores";
import { supabase } from "@/lib/supabase";

type Flag = { id: string; profile_id: string; ends_on: string };

// Leader dashboard (product map section 4): his group only, tiers not numbers.
export default function LeaderDashboard() {
  const c = useColors();
  const { state } = useGroup();
  const { state: auth } = useAuth();
  const group = state.status === "ready" ? state.group : null;
  const { tiers, reload: reloadTiers } = useGroupTiers(group?.groupId ?? null);
  const [lastContact, setLastContact] = useState<Map<string, Date>>(new Map());
  const [flags, setFlags] = useState<Flag[]>([]);
  const me = auth.status === "ready" ? auth.session.user.id : null;
  const ministryId = auth.status === "ready" ? auth.membership.ministryId : null;

  const load = useCallback(async () => {
    if (!group) return;
    const ids = group.roster.map((m) => m.profileId);
    const [contacts, seasons] = await Promise.all([
      supabase.from("contact_logs").select("profile_id, contacted_at").in("profile_id", ids).order("contacted_at", { ascending: false }),
      supabase.from("season_flags").select("id, profile_id, ends_on").in("profile_id", ids).gte("ends_on", new Date().toISOString().slice(0, 10)),
    ]);
    const latest = new Map<string, Date>();
    for (const r of contacts.data ?? []) if (!latest.has(r.profile_id)) latest.set(r.profile_id, new Date(r.contacted_at));
    setLastContact(latest);
    setFlags(seasons.data ?? []);
  }, [group]);
  useFocusEffect(useCallback(() => void load(), [load]));

  if (!group || tiers === null || !me || !ministryId) return <Loading />;

  const men = group.roster.filter((m) => m.profileId !== me);
  const flagOf = new Map(flags.map((f) => [f.profile_id, f]));
  const needsCall = men.filter((m) => {
    const t = tiers.get(m.profileId);
    return t && !t.isNew && !t.paused && (t.tier === "Disconnected" || t.velocity);
  });
  const monthAgo = Date.now() - 30 * 86_400_000;
  const uncovered = men.filter((m) => (lastContact.get(m.profileId)?.getTime() ?? 0) < monthAgo);
  const recent = group.past.filter((m) => m.markedAt).slice(0, 8).reverse();

  const setSeason = (profileId: string, name: string) =>
    Alert.alert(`Season of life for ${name.split(" ")[0]}?`, "Pauses his alerts while he walks through something hard. He stays on your roster.", [
      ...[14, 30, 60].map((days) => ({
        text: `${days} days`,
        onPress: async () => {
          const ends = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
          const { error } = await supabase.from("season_flags").insert({ ministry_id: ministryId, profile_id: profileId, set_by: me, ends_on: ends });
          if (error) Alert.alert("Not saved", error.message);
          void load();
          void reloadTiers();
        },
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);

  const endSeason = async (flag: Flag) => {
    await supabase.from("season_flags").delete().eq("id", flag.id);
    void load();
  };

  return (
    <Screen>
      <Card title={needsCall.length ? `Needs a call (${needsCall.length})` : "Needs a call"}>
        {needsCall.length === 0 ? <Body muted>No one right now.</Body> : null}
        {needsCall.map((m) => {
          const t = tiers.get(m.profileId)!;
          return (
            <View key={m.profileId} style={styles.row}>
              <View style={styles.flex}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{m.fullName}</Text>
                <Text style={{ color: TIER_COLOR[t.tier], fontSize: 13 }}>{t.velocity ? "Trending down 3 weeks" : TIER_HINT[t.tier]}</Text>
              </View>
              {m.phone ? <Chip label="Call" onPress={() => void Linking.openURL(`tel:${m.phone}`)} /> : null}
            </View>
          );
        })}
        {needsCall.length ? <Body muted>Log the call from the Roster tab when you are done.</Body> : null}
      </Card>

      <Card title="My men">
        {tiers.size === 0 ? <Body muted>Tiers appear after the first Sunday night scoring.</Body> : null}
        {men.map((m) => {
          const t = tiers.get(m.profileId);
          const flag = flagOf.get(m.profileId);
          return (
            <View key={m.profileId} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: t ? TIER_COLOR[t.tier] : c.border }]} />
              <View style={styles.flex}>
                <Text style={{ color: c.text, fontSize: 16 }}>{m.fullName}</Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>
                  {t ? `${t.tier}${t.trend && TREND_WORD[t.trend] ? `, ${TREND_WORD[t.trend]}` : ""}` : "Not scored yet"}
                  {flag ? `  Season until ${new Date(`${flag.ends_on}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
                </Text>
              </View>
              {flag ? <Chip label="End season" onPress={() => void endSeason(flag)} /> : <Chip label="Season" onPress={() => setSeason(m.profileId, m.fullName)} />}
            </View>
          );
        })}
      </Card>

      <Card title="Contact coverage (30 days)">
        <Body muted>{men.length - uncovered.length} of {men.length} men contacted.</Body>
        {uncovered.map((m) => (
          <Text key={m.profileId} style={{ color: c.text, fontSize: 15 }}>
            {m.fullName}: {lastContact.get(m.profileId) ? `last ${timeAgo(lastContact.get(m.profileId)!)}` : "no contact logged"}
          </Text>
        ))}
      </Card>

      <Card title="Attendance (last 8 meetings)">
        {recent.length === 0 ? <Body muted>No marked meetings yet.</Body> : (
          <ScrollView horizontal>
            <View>
              <View style={styles.gridRow}>
                <Text style={[styles.gridName, { color: c.muted }]} />
                {recent.map((mt) => (
                  <Text key={mt.id} style={[styles.gridCell, { color: c.muted }]}>{formatMeeting(mt.meetingAt).split(",")[1]?.trim().split(" ").slice(0, 2).join(" ")}</Text>
                ))}
              </View>
              {group.roster.map((m) => (
                <View key={m.profileId} style={styles.gridRow}>
                  <Text style={[styles.gridName, { color: c.text }]} numberOfLines={1}>{m.fullName.split(" ")[0]}</Text>
                  {recent.map((mt) => {
                    const s = mt.statuses[m.profileId];
                    return (
                      <Text key={mt.id} style={[styles.gridCell, { color: s === "present" ? c.accent : s === "excused" ? c.muted : c.error }]}>
                        {s === "present" ? "Here" : s === "excused" ? "Exc" : s === "absent" ? "Out" : "-"}
                      </Text>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </Card>
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
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  flex: { flex: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minHeight: 40, justifyContent: "center" },
  gridRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3 },
  gridName: { width: 80, fontSize: 13 },
  gridCell: { width: 52, fontSize: 12, textAlign: "center" },
});
