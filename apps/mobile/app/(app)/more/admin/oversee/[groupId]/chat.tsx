import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Linkify } from "@/components/Linkify";
import { Loading, useColors } from "@/components/ui";
import { useOverseenGroup } from "@/lib/oversee";
import { timeAgo } from "@/lib/pray";
import { supabase } from "@/lib/supabase";

type Message = { id: string; profile_id: string; body: string; created_at: string };

// An overseer reads a group's chat (0020). Read only: there is no composer, and the
// database refuses a post from anyone not in the group.
export default function OverseeChat() {
  const c = useColors();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { state } = useOverseenGroup(groupId);
  const [messages, setMessages] = useState<Message[] | null>(null);

  useEffect(() => {
    let live = true;
    void supabase
      .from("group_messages")
      .select("id, profile_id, body, created_at")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => live && setMessages(data ?? []));
    const channel = supabase
      .channel(`oversee-chat-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` }, (payload) => {
        const m = payload.new as Message;
        setMessages((prev) => (prev?.some((x) => x.id === m.id) ? prev : [m, ...(prev ?? [])]));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "group_messages" }, (payload) =>
        setMessages((prev) => prev?.filter((x) => x.id !== (payload.old as { id: string }).id) ?? null))
      .subscribe();
    return () => {
      live = false;
      void supabase.removeChannel(channel);
    };
  }, [groupId]);

  if (state.status === "loading" || messages === null) return <Loading />;
  const names = new Map(state.status === "ready" ? state.group.roster.map((m) => [m.profileId, m.fullName]) : []);

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={["left", "right", "bottom"]}>
      <FlatList
        style={styles.flex}
        inverted
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={{ color: c.muted, textAlign: "center" }}>No messages yet.</Text>}
        renderItem={({ item: m }) => (
          <View style={[styles.bubble, { backgroundColor: c.field, borderColor: c.border }]}>
            <Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>{names.get(m.profile_id) ?? "Former member"}</Text>
            <Text style={{ color: c.text, fontSize: 16, lineHeight: 21 }}><Linkify text={m.body} /></Text>
            <Text style={{ color: c.muted, fontSize: 11, alignSelf: "flex-end" }}>{timeAgo(new Date(m.created_at))}</Text>
          </View>
        )}
      />
      <View style={[styles.footer, { borderTopColor: c.border }]}>
        <Text style={{ color: c.muted, fontSize: 13, textAlign: "center" }}>You are reading as an overseer. Only the men in this group can post.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 12, gap: 8 },
  bubble: { maxWidth: "90%", borderRadius: 14, padding: 10, gap: 2, borderWidth: 1, alignSelf: "flex-start" },
  footer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
