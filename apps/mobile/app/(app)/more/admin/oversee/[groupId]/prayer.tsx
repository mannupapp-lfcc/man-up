import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Linkify } from "@/components/Linkify";
import { Body, Loading, Screen, useColors } from "@/components/ui";
import { loadComments, timeAgo, type PrayerComment } from "@/lib/pray";
import { supabase } from "@/lib/supabase";

type Row = { id: string; body: string; answered: boolean; answeredNote: string | null; author: string; createdAt: Date; prayed: number; comments: number };

// An overseer reads a group's prayer wall (group_prayer_wall, 0020): group-only
// requests, anonymous authors kept hidden. Read only: he cannot pray or respond here.
export default function OverseePrayer() {
  const c = useColors();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<Record<string, PrayerComment[] | null>>({});

  const load = useCallback(async () => {
    const { data } = await supabase.rpc("group_prayer_wall", { p_group: groupId });
    setRows((data ?? []).map((r) => ({
      id: r.id, body: r.body, answered: r.status === "answered", answeredNote: r.answered_note,
      author: r.is_anonymous ? "Anonymous" : r.author_name ?? "A brother",
      createdAt: new Date(r.created_at), prayed: r.prayed_count, comments: r.comment_count,
    })));
  }, [groupId]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const toggle = async (id: string) => {
    if (id in open) {
      const { [id]: _, ...rest } = open;
      return setOpen(rest);
    }
    setOpen((o) => ({ ...o, [id]: null }));
    const list = await loadComments(id);
    setOpen((o) => (id in o ? { ...o, [id]: list ?? [] } : o));
  };

  if (!rows) return <Loading />;

  return (
    <Screen>
      <Body muted>Requests shared with this group only. Ministry-wide requests are on your Pray tab. Anonymous requests stay anonymous.</Body>
      {rows.length === 0 ? <Body muted>No group prayer requests.</Body> : null}
      {rows.map((r) => (
        <View key={r.id} style={[styles.card, { backgroundColor: c.field, borderColor: r.answered ? c.accent : c.border }]}>
          <View style={styles.meta}>
            <Text style={{ color: c.text, fontWeight: "700", fontSize: 15 }}>{r.author}</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{timeAgo(r.createdAt)}</Text>
          </View>
          <Text style={{ color: c.text, fontSize: 16, lineHeight: 25 }}><Linkify text={r.body} /></Text>
          {r.answered ? (
            <Text style={{ color: c.accent, fontWeight: "700" }}>Answered{r.answeredNote ? `: ${r.answeredNote}` : ""}</Text>
          ) : null}
          <Pressable accessibilityRole="button" disabled={r.comments === 0} onPress={() => void toggle(r.id)}>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {r.prayed} prayed, {r.comments} {r.comments === 1 ? "response" : "responses"}{r.comments ? (r.id in open ? "  Hide" : "  Show") : ""}
            </Text>
          </Pressable>
          {r.id in open ? (open[r.id] === null ? <Body muted>Loading...</Body> : open[r.id]!.map((cm) => (
            <View key={cm.id} style={[styles.comment, { borderColor: c.border }]}>
              <Text style={{ color: c.text, fontWeight: "700", fontSize: 14 }}>{cm.authorName} <Text style={{ color: c.muted, fontWeight: "400" }}>{timeAgo(cm.createdAt)}</Text></Text>
              <Text style={{ color: c.text, fontSize: 15 }}><Linkify text={cm.body} /></Text>
            </View>
          ))) : null}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  meta: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  comment: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 2 },
});
