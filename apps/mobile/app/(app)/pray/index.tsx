import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PrayerCard } from "@/components/PrayerCard";
import { openSafetyMenu } from "@/components/safety";
import { Body, Button, Eyebrow, Loading, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { setPrayed, usePrayerWall } from "@/lib/pray";

import { colors } from "@/lib/theme";

type Filter = "all" | "group" | "ministry";

export default function PrayerWall() {
  const { state: auth } = useAuth();
  const { state, reload, ministryId } = usePrayerWall();
  const [filter, setFilter] = useState<Filter>("all");
  const me = auth.status === "ready" ? auth.session.user.id : null;

  if (state.status === "loading" || !me || !ministryId) return <Loading />;
  if (state.status === "error")
    return (
      <Screen>
        <Body>Could not load prayer requests. Check your connection.</Body>
        <Button title="Try again" onPress={() => void reload()} />
      </Screen>
    );

  const shown = state.requests.filter((r) => filter === "all" || r.visibility === filter);

  return (
    <Screen>
      <Eyebrow>Stand together</Eyebrow>
      <Title>No man stands alone.</Title>
      <Body muted>Bring what’s on your heart. Lift up a brother.</Body>
      <Button title="Share a prayer request" onPress={() => router.push("/pray/new")} />
      <View style={styles.filters}>
        {(["all", "group", "ministry"] as const).map((f) => (
          <Pressable key={f} accessibilityRole="button" accessibilityState={{ selected: filter === f }}
            onPress={() => setFilter(f)} style={({ pressed }) => [styles.filter, filter === f && styles.selected, pressed && { opacity: 0.75 }]}>
            <Text style={{ color: filter === f ? colors.gold : colors.muted, fontSize: 14, fontWeight: "700", textAlign: "center" }}>
              {f === "all" ? "All" : f === "group" ? "My group" : "Ministry"}
            </Text>
          </Pressable>
        ))}
      </View>
      {shown.length === 0 ? <Body muted>No prayer requests yet. Be the first to share one.</Body> : null}
      {shown.map((r) => (
        <PrayerCard
          key={r.id}
          request={r}
          onTogglePrayed={async () => {
            await setPrayed(ministryId, r.id, me, !r.iPrayed);
            void reload();
          }}
          onLongPress={
            r.isMine
              ? undefined
              : () => openSafetyMenu({ ministryId, me, targetType: "prayer_request", targetId: r.id, authorId: r.authorId, authorName: r.authorName, onBlocked: reload })
          }
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filter: { flex: 1, minHeight: 48, padding: 10, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  selected: { backgroundColor: colors.navy },
});
