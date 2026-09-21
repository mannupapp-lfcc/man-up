import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Card, Screen, useColors } from "@/components/ui";
import { formatMeeting, markedTooLate, useGroup, type Meeting } from "@/lib/group";

export default function Meetings() {
  const { state } = useGroup();
  const group = state.status === "ready" ? state.group : null;
  if (!group) return null;

  const STATUS = { present: "You were there", absent: "You missed this one", excused: "Excused" } as const;

  return (
    <Screen>
      <Card title="Upcoming">
        {group.upcoming.length === 0 ? <Body muted>No meetings scheduled yet.</Body> : null}
        {group.upcoming.map((m) => (
          <Body key={m.id}>{formatMeeting(m.meetingAt)}</Body>
        ))}
      </Card>

      <Card title="Past">
        {group.past.length === 0 ? <Body muted>No meetings yet.</Body> : null}
        {group.past.map((m) =>
          group.iLead ? (
            <LeaderRow key={m.id} meeting={m} />
          ) : (
            <View key={m.id} style={styles.row}>
              <Body>{formatMeeting(m.meetingAt)}</Body>
              <Body muted>{m.myStatus ? STATUS[m.myStatus] : m.markedAt ? "Not marked for you" : "Not marked yet"}</Body>
            </View>
          ),
        )}
      </Card>

      {!group.iLead ? <Body muted>Your leader sees attendance for the group. Only you see your own record here.</Body> : null}
    </Screen>
  );
}

// Leaders open the nested attendance route for any past meeting.
function LeaderRow({ meeting }: { meeting: Meeting }) {
  const c = useColors();
  const present = Object.values(meeting.statuses).filter((s) => s === "present").length;
  const detail = meeting.markedAt
    ? `${present} of ${Object.keys(meeting.statuses).length} present`
    : markedTooLate(meeting)
      ? "Past 72 hours: will not count as held"
      : "Needs attendance";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/group/attendance/[meetingId]", params: { meetingId: meeting.id } })}
      style={styles.row}
    >
      <View style={styles.flex}>
        <Text style={{ color: c.text, fontSize: 16 }}>{formatMeeting(meeting.meetingAt)}</Text>
        <Text style={{ color: meeting.markedAt ? c.muted : c.accent, fontSize: 13 }}>{detail}</Text>
      </View>
      <Text style={{ color: c.accent, fontSize: 15, fontWeight: "600" }}>{meeting.markedAt ? "Edit" : "Mark"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, justifyContent: "space-between", flexWrap: "wrap" },
  flex: { flex: 1 },
});
