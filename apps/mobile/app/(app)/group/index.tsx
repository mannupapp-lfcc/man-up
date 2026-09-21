import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Loading, Screen, Title, useColors } from "@/components/ui";
import { formatMeeting, formatSchedule, myAttendanceSummary, useGroup } from "@/lib/group";

const SECTIONS: { href: Href; label: string; hint: string }[] = [
  { href: "/group/chat", label: "Chat", hint: "Talk with your group" },
  { href: "/group/meetings", label: "Meetings", hint: "Schedule and attendance" },
  { href: "/group/questions", label: "Questions", hint: "This week's discussion" },
  { href: "/group/roster", label: "Roster", hint: "The men in your group" },
];

export default function GroupOverview() {
  const { state, reload } = useGroup();

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
  const next = group.upcoming[0];
  const summary = myAttendanceSummary(group.past);
  const toMark = group.past.filter((m) => !m.markedAt).length;

  return (
    <Screen>
      <Title>{group.name}</Title>
      {schedule ? <Body muted>Meets {schedule}</Body> : null}

      <Card title="Next meeting">
        <Body>{next ? formatMeeting(next.meetingAt) : "No meetings scheduled yet."}</Body>
      </Card>

      {group.iLead ? (
        <Card title="Leader tools">
          <Body muted>
            {toMark > 0 ? `${toMark} ${toMark === 1 ? "meeting needs" : "meetings need"} attendance marked.` : "Attendance is up to date."}
          </Body>
          <Button title="Mark attendance" onPress={() => router.push("/group/meetings")} />
          <Button title="Leader dashboard" variant="secondary" onPress={() => router.push("/group/dashboard")} />
        </Card>
      ) : null}

      <View style={styles.grid}>
        {SECTIONS.map((s) => (
          <SectionLink key={s.label} {...s} />
        ))}
      </View>

      <Card title="My attendance">
        {summary.total === 0 ? (
          <Body muted>No meetings marked yet.</Body>
        ) : (
          <>
            <Body>You were there {summary.present} of the last {summary.total} meetings.</Body>
            {summary.streak > 1 ? <Body muted>{summary.streak} in a row. Keep showing up.</Body> : null}
          </>
        )}
      </Card>
    </Screen>
  );
}

function SectionLink({ href, label, hint }: { href: Href; label: string; hint: string }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.tile, { backgroundColor: c.navy, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}
    >
      <Text style={{ color: c.text, fontSize: 17, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: c.muted, fontSize: 13 }}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexGrow: 1, flexBasis: "45%", borderWidth: 1, borderRadius: 12, padding: 16, gap: 4, minHeight: 84 },
});
