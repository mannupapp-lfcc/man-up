import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Body, Card, Loading, Screen, useColors } from "@/components/ui";
import { pulseByWeek, useGroupCheckins } from "@/lib/checkins";
import { formatMeeting } from "@/lib/group";
import { useOverseenGroup } from "@/lib/oversee";
import { timeAgo } from "@/lib/pray";
import { TIER_COLOR, TIER_HINT, TREND_WORD, useGroupTiers } from "@/lib/scores";

// What the group's leader sees on his dashboard, for an overseer, read only:
// tiers (never numbers), who needs a call, contact coverage, pulse, attendance.
export default function OverseeDashboard() {
  const c = useColors();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { state } = useOverseenGroup(groupId);
  const { tiers } = useGroupTiers(groupId);
  const { rows: checkins } = useGroupCheckins(groupId, 8);
  const [monthAgo] = useState(() => Date.now() - 30 * 86_400_000);

  if (state.status === "loading" || tiers === null) return <Loading />;
  if (state.status === "missing") return <Screen><Body>This group is not available.</Body></Screen>;
  const group = state.group;

  const men = group.roster;
  const needsCall = men.filter((m) => {
    const t = tiers.get(m.profileId);
    return t && !t.isNew && !t.paused && (t.tier === "Disconnected" || t.velocity);
  });
  const uncovered = men.filter((m) => (group.lastContact.get(m.profileId)?.getTime() ?? 0) < monthAgo);
  const recent = group.past.filter((m) => m.markedAt).reverse();
  const leaders = group.roster.filter((m) => m.leads).map((m) => m.fullName);

  return (
    <Screen>
      <Body muted>{leaders.length ? `Led by ${leaders.join(" and ")}.` : "No leader yet."} You see what the leader sees. Nothing here can be changed.</Body>

      <Card title={needsCall.length ? `Needs a call (${needsCall.length})` : "Needs a call"}>
        {needsCall.length === 0 ? <Body muted>No one right now.</Body> : null}
        {needsCall.map((m) => {
          const t = tiers.get(m.profileId)!;
          return (
            <View key={m.profileId} style={styles.row}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{m.fullName}</Text>
              <Text style={{ color: TIER_COLOR[t.tier], fontSize: 13 }}>{t.velocity ? "Trending down 3 weeks" : TIER_HINT[t.tier]}</Text>
            </View>
          );
        })}
      </Card>

      <Card title="The men">
        {tiers.size === 0 ? <Body muted>Tiers appear after the first Sunday night scoring.</Body> : null}
        {men.map((m) => {
          const t = tiers.get(m.profileId);
          return (
            <View key={m.profileId} style={styles.line}>
              <View style={[styles.dot, { backgroundColor: t ? TIER_COLOR[t.tier] : c.border }]} />
              <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{m.fullName}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>
                {t ? `${t.tier}${t.trend && TREND_WORD[t.trend] ? `, ${TREND_WORD[t.trend]}` : ""}${t.paused ? ", season" : ""}` : "Not scored yet"}
              </Text>
            </View>
          );
        })}
      </Card>

      <Card title="Contact coverage (30 days)">
        <Body muted>{men.length - uncovered.length} of {men.length} men contacted.</Body>
        {uncovered.map((m) => (
          <Text key={m.profileId} style={{ color: c.text, fontSize: 15 }}>
            {m.fullName}: {group.lastContact.get(m.profileId) ? `last ${timeAgo(group.lastContact.get(m.profileId)!)}` : "no contact logged"}
          </Text>
        ))}
      </Card>

      <Card title="Group pulse (weekly check-in)">
        {!checkins || checkins.length === 0 ? <Body muted>No check-ins yet.</Body> : pulseByWeek(checkins).map((w) => (
          <View key={w.weekOf} style={styles.line}>
            <Text style={{ color: c.muted, fontSize: 13, width: 52 }}>
              {new Date(`${w.weekOf}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </Text>
            <View style={[styles.track, { backgroundColor: c.border }]}>
              <View style={{ width: `${(w.average / 5) * 100}%`, height: "100%", borderRadius: 4, backgroundColor: c.accent }} />
            </View>
            <Text style={{ color: c.text, fontSize: 13, width: 92, textAlign: "right" }}>
              {w.average.toFixed(1)} ({w.answered} of {group.roster.length})
            </Text>
          </View>
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

const styles = StyleSheet.create({
  row: { gap: 2, paddingVertical: 6 },
  line: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  gridRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3 },
  gridName: { width: 80, fontSize: 13 },
  gridCell: { width: 52, fontSize: 12, textAlign: "center" },
});
