import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Body, Card, Loading, Screen, useColors } from "@/components/ui";
import { SCALE_LABEL, useGroupCheckins } from "@/lib/checkins";

// An overseer reads a group's weekly check-ins with notes (0020), last 4 weeks.
export default function OverseeCheckins() {
  const c = useColors();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { rows } = useGroupCheckins(groupId, 4);
  if (!rows) return <Loading />;

  const weeks = [...new Set(rows.map((r) => r.weekOf))];
  return (
    <Screen>
      {weeks.length === 0 ? <Body muted>No check-ins in the last 4 weeks.</Body> : null}
      {weeks.map((w) => (
        <Card key={w} title={`Week of ${new Date(`${w}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}>
          {rows.filter((r) => r.weekOf === w).map((r) => (
            <View key={r.id} style={[styles.row, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>
                {r.fullName} <Text style={{ color: c.accent }}>{r.scale}</Text>
                <Text style={{ color: c.muted, fontWeight: "400" }}> {SCALE_LABEL[r.scale]}</Text>
              </Text>
              {r.note ? <Text style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>{r.note}</Text> : null}
            </View>
          ))}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
