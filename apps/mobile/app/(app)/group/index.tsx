import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Loading, Screen, Title, useColors } from "@/components/ui";
import {
  formatMeeting,
  formatSchedule,
  markedTooLate,
  myAttendanceSummary,
  useMyGroup,
  type Meeting,
} from "@/lib/group";

export default function MyGroupScreen() {
  const { state, reload } = useMyGroup();
  const c = useColors();

  if (state.status === "loading") return <Loading />;
  if (state.status === "error")
    return (
      <Screen>
        <Body>Could not load your group. Check your connection.</Body>
        <Button title="Try again" onPress={() => void reload()} />
      </Screen>
    );

  const group = state.group;
  if (!group)
    return (
      <Screen>
        <Title>Get connected</Title>
        <Body>
          You are not in a group yet. Groups of 4 to 8 men meet every week to pray, talk, and hold each other up. A
          ministry leader will place you in one soon.
        </Body>
      </Screen>
    );

  const schedule = formatSchedule(group.meetingDay, group.meetingTime);
  const summary = myAttendanceSummary(group.past);
  const toMark = group.iLead ? group.past.filter((m) => !m.markedAt) : [];

  return (
    <Screen>
      <Title>{group.name}</Title>
      {schedule ? <Body muted>Meets {schedule}</Body> : null}

      {group.iLead && toMark.length > 0 ? (
        <Card title="Attendance to mark">
          {toMark.map((m) => (
            <MeetingRow key={m.id} meeting={m} onPress={() => router.push(`/group/meeting/${m.id}`)}>
              {markedTooLate(m) ? "Past 72 hours: will not count as held" : "Tap to mark"}
            </MeetingRow>
          ))}
        </Card>
      ) : null}

      <Card title="Upcoming">
        {group.upcoming.length === 0 ? <Body muted>No meetings scheduled yet.</Body> : null}
        {group.upcoming.map((m) => (
          <Body key={m.id}>{formatMeeting(m.meetingAt)}</Body>
        ))}
      </Card>

      <Card title="My attendance">
        {summary.total === 0 ? (
          <Body muted>No meetings marked yet.</Body>
        ) : (
          <>
            <Body>
              You were there {summary.present} of the last {summary.total} meetings.
            </Body>
            {summary.streak > 1 ? <Body muted>{summary.streak} in a row. Keep showing up.</Body> : null}
          </>
        )}
      </Card>

      {group.iLead ? (
        <Card title="Recent meetings">
          {group.past.filter((m) => m.markedAt).map((m) => {
            const present = Object.values(m.statuses).filter((s) => s === "present").length;
            return (
              <MeetingRow key={m.id} meeting={m} onPress={() => router.push(`/group/meeting/${m.id}`)}>
                {present} of {Object.keys(m.statuses).length} present
              </MeetingRow>
            );
          })}
        </Card>
      ) : null}

      <Card title="Roster">
        {group.roster.map((man) => (
          <View key={man.profileId} style={styles.row}>
            <View style={styles.flex}>
              <Text style={{ color: c.text, fontSize: 16 }}>{man.fullName}</Text>
              {man.leads ? <Text style={{ color: c.muted, fontSize: 13 }}>Leader</Text> : null}
            </View>
            {man.phone ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Call ${man.fullName}`}
                onPress={() => void Linking.openURL(`tel:${man.phone}`)}>
                <Text style={{ color: c.accent, fontSize: 15 }}>Call</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </Card>

      {!group.iLead ? (
        <Body muted>
          Your leader sees attendance for the group. Only you see your own record here.
        </Body>
      ) : null}
    </Screen>
  );
}

function MeetingRow({ meeting, onPress, children }: { meeting: Meeting; onPress: () => void; children: React.ReactNode }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={styles.flex}>
        <Text style={{ color: c.text, fontSize: 16 }}>{formatMeeting(meeting.meetingAt)}</Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>{children}</Text>
      </View>
      <Text style={{ color: c.accent, fontSize: 15 }}>{meeting.markedAt ? "Edit" : "Mark"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  flex: { flex: 1 },
});
