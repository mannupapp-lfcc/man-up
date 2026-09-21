import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { PrayerCard } from "@/components/PrayerCard";
import { openSafetyMenu } from "@/components/safety";
import { Body, Button, Loading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { setPrayed, usePrayerWall } from "@/lib/pray";

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
      <Button title="Share a prayer request" onPress={() => router.push("/pray/new")} />
      <View style={styles.filters}>
        {(["all", "group", "ministry"] as const).map((f) => (
          <View key={f} style={styles.filter}>
            <Button
              title={f === "all" ? "All" : f === "group" ? "My group" : "Ministry"}
              variant={filter === f ? "primary" : "secondary"}
              onPress={() => setFilter(f)}
            />
          </View>
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
  filters: { flexDirection: "row", gap: 8 },
  filter: { flex: 1 },
});
