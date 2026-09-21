import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/components/ui";
import { timeAgo, type PrayerRequest } from "@/lib/pray";

export function PrayerCard({
  request: r,
  onTogglePrayed,
  onLongPress,
  full,
}: {
  request: PrayerRequest;
  onTogglePrayed: () => void;
  onLongPress?: () => void;
  full?: boolean;
}) {
  const c = useColors();
  const author = r.anonymous ? (r.isMine ? "You (anonymous)" : "Anonymous") : r.isMine ? "You" : r.authorName ?? "A brother";
  return (
    <Pressable
      onPress={full ? undefined : () => router.push({ pathname: "/pray/[requestId]", params: { requestId: r.id } })}
      onLongPress={onLongPress}
      accessibilityHint={onLongPress ? "Long press for report and block options" : undefined}
      style={[styles.card, { backgroundColor: c.field, borderColor: r.answered ? c.accent : c.border }]}
    >
      <View style={styles.meta}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }}>{author}</Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>
          {r.visibility === "ministry" ? "Whole ministry" : "My group"} - {timeAgo(r.createdAt)}
        </Text>
      </View>
      <Text style={{ color: c.text, fontSize: 16, lineHeight: 22 }} numberOfLines={full ? undefined : 5}>
        {r.body}
      </Text>
      {r.answered ? (
        <View style={[styles.answered, { borderColor: c.accent }]}>
          <Text style={{ color: c.accent, fontWeight: "700" }}>Answered</Text>
          {r.answeredNote ? <Text style={{ color: c.text, fontSize: 15 }}>{r.answeredNote}</Text> : null}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: r.iPrayed }}
          onPress={onTogglePrayed}
          style={[styles.pill, r.iPrayed ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.border }]}
        >
          <Text style={{ color: r.iPrayed ? c.onAccent : c.text, fontWeight: "600" }}>
            {r.iPrayed ? "You prayed" : "I prayed"}{r.prayedCount ? `  ${r.prayedCount}` : ""}
          </Text>
        </Pressable>
        {!full ? <Text style={{ color: c.muted, fontSize: 14 }}>{r.commentCount ? `${r.commentCount} comments` : "Comment"}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  meta: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
  answered: { borderLeftWidth: 3, paddingLeft: 10, gap: 2 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pill: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: "center" },
});
