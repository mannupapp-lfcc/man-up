import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Screen, useColors } from "@/components/ui";
import { useGroup } from "@/lib/group";

export default function Roster() {
  const { state } = useGroup();
  const c = useColors();
  const group = state.status === "ready" ? state.group : null;
  if (!group) return null;

  return (
    <Screen>
      <Card title={`${group.roster.length} men`}>
        {group.roster.map((man) => (
          <View key={man.profileId} style={styles.row}>
            <View style={styles.flex}>
              <Text style={{ color: c.text, fontSize: 16 }}>{man.fullName}</Text>
              {man.leads ? <Text style={{ color: c.accent, fontSize: 13 }}>Leader</Text> : null}
            </View>
            {man.phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Call ${man.fullName}`}
                onPress={() => void Linking.openURL(`tel:${man.phone}`)}
                style={[styles.call, { borderColor: c.accent }]}
              >
                <Text style={{ color: c.accent, fontSize: 15, fontWeight: "600" }}>Call</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  flex: { flex: 1 },
  call: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: "center" },
});
