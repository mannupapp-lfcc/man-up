import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Loading, Screen, useColors } from "@/components/ui";
import { formatGathering, nextGathering, useGatherings, type Gathering } from "@/lib/gatherings";

export default function GatheringsList() {
  const { state, reload } = useGatherings();
  if (state.status === "loading") return <Loading />;
  if (state.status === "error")
    return (
      <Screen>
        <Body>Could not load gatherings. Check your connection.</Body>
        <Button title="Try again" onPress={() => void reload()} />
      </Screen>
    );

  const next = nextGathering(state.upcoming);
  const later = state.upcoming.filter((g) => g !== next);

  return (
    <Screen>
      {next ? (
        <Card title="Next gathering">
          <GatheringRow gathering={next} large />
        </Card>
      ) : (
        <Card title="Next gathering">
          <Body muted>Nothing scheduled right now. Check back soon.</Body>
        </Card>
      )}

      {later.length ? (
        <Card title="Coming up">
          {later.map((g) => (
            <GatheringRow key={g.id} gathering={g} />
          ))}
        </Card>
      ) : null}

      {state.recent.length ? (
        <Card title="Recent">
          {state.recent.map((g) => (
            <GatheringRow key={g.id} gathering={g} />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function GatheringRow({ gathering: g, large }: { gathering: Gathering; large?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/gatherings/[gatheringId]", params: { gatheringId: g.id } })}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.flex}>
        <Text style={{ color: g.canceled ? c.muted : c.text, fontSize: large ? 19 : 16, fontWeight: "700", textDecorationLine: g.canceled ? "line-through" : "none" }}>
          {g.title}
        </Text>
        <Text style={{ color: c.muted, fontSize: 14 }}>{formatGathering(g)}</Text>
        {g.canceled ? <Text style={{ color: c.error, fontSize: 13 }}>Canceled</Text> : null}
      </View>
      <Text style={{ color: c.accent, fontSize: 18 }}>{">"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, minHeight: 48 },
  flex: { flex: 1, gap: 2 },
});
