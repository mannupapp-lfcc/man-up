import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, ErrorText, Loading, Screen, useColors } from "@/components/ui";
import { formatMeeting, markedTooLate, useMyGroup, type AttendanceStatus } from "@/lib/group";
import { supabase } from "@/lib/supabase";

const OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
];

// Leaders mark every man in one step. Everyone starts as present (the common case);
// the leader changes only the men who were missing.
export default function MarkAttendance() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useMyGroup();
  const c = useColors();
  const [marks, setMarks] = useState<Record<string, AttendanceStatus> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const group = state.status === "ready" ? state.group : null;
  const meeting = group?.past.find((m) => m.id === id);

  useEffect(() => {
    if (!group || !meeting || marks) return;
    setMarks(Object.fromEntries(group.roster.map((man) => [man.profileId, meeting.statuses[man.profileId] ?? "present"])));
  }, [group, meeting, marks]);

  if (state.status === "loading" || (group && meeting && !marks)) return <Loading />;
  if (!group?.iLead || !meeting || !marks)
    return (
      <Screen>
        <Body>This meeting can't be marked here.</Body>
      </Screen>
    );

  async function save() {
    if (!marks) return;
    setBusy(true);
    setError(null);
    const ids = (s: AttendanceStatus) => Object.keys(marks).filter((p) => marks[p] === s);
    const { error: err } = await supabase.rpc("mark_attendance", {
      p_meeting: id,
      p_present: ids("present"),
      p_excused: ids("excused"),
    });
    setBusy(false);
    if (err) return setError(err.message);
    router.back();
  }

  return (
    <Screen>
      <Body>{formatMeeting(meeting.meetingAt)}</Body>
      {!meeting.markedAt && markedTooLate(meeting) ? (
        <Body muted>
          It has been more than 72 hours, so this meeting will not count as held. Marking still records who came.
        </Body>
      ) : null}

      {group.roster.map((man) => (
        <View key={man.profileId} style={[styles.man, { borderColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{man.fullName}</Text>
          <View style={styles.options} accessibilityRole="radiogroup">
            {OPTIONS.map((o) => {
              const on = marks[man.profileId] === o.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`${man.fullName} ${o.label}`}
                  onPress={() => setMarks({ ...marks, [man.profileId]: o.value })}
                  style={[styles.option, { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : "transparent" }]}
                >
                  <Text style={{ color: on ? c.onAccent : c.text, fontSize: 14 }}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <ErrorText>{error}</ErrorText>
      <Button title={meeting.markedAt ? "Save changes" : "Save attendance"} onPress={save} busy={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  man: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, gap: 8 },
  options: { flexDirection: "row", gap: 8 },
  option: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, minHeight: 40, justifyContent: "center" },
});
