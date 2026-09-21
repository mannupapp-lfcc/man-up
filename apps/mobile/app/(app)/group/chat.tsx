import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { openSafetyMenu } from "@/components/safety";
import { Loading, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useGroup } from "@/lib/group";
import { timeAgo } from "@/lib/pray";
import { supabase } from "@/lib/supabase";

type Message = { id: string; profile_id: string; body: string; created_at: string };

// Group chat: RLS limits reads to current members of this group (minus men he has
// blocked), and Realtime applies the same policy to live updates.
export default function Chat() {
  const c = useColors();
  const { state: auth } = useAuth();
  const { state } = useGroup();
  const group = state.status === "ready" ? state.group : null;
  const me = auth.status === "ready" ? auth.session.user.id : null;
  const ministryId = auth.status === "ready" ? auth.membership.ministryId : null;
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const names = new Map(group?.roster.map((m) => [m.profileId, m.fullName]) ?? []);

  const load = useCallback(async () => {
    if (!group) return;
    const { data } = await supabase
      .from("group_messages")
      .select("id, profile_id, body, created_at")
      .eq("group_id", group.groupId)
      .order("created_at", { ascending: false })
      .limit(50);
    setMessages(data ?? []);
  }, [group]);

  useEffect(() => {
    if (!group) return;
    void load();
    const channel = supabase
      .channel(`group-chat-${group.groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${group.groupId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => (prev?.some((x) => x.id === m.id) ? prev : [m, ...(prev ?? [])]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "group_messages" },
        (payload) => setMessages((prev) => prev?.filter((x) => x.id !== (payload.old as { id: string }).id) ?? null),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [group, load]);

  if (!group || !me || !ministryId || messages === null) return <Loading />;

  async function send() {
    const body = draft.trim();
    if (!body || !group || !me || !ministryId) return;
    setSending(true);
    const { data, error } = await supabase
      .from("group_messages")
      .insert({ ministry_id: ministryId, group_id: group.groupId, profile_id: me, body })
      .select("id, profile_id, body, created_at")
      .single();
    setSending(false);
    if (error) return Alert.alert("Not sent", error.message);
    setDraft("");
    setMessages((prev) => (prev?.some((x) => x.id === data.id) ? prev : [data, ...(prev ?? [])]));
  }

  function onLongPress(m: Message) {
    if (!me || !ministryId) return;
    if (m.profile_id === me) {
      Alert.alert("Delete this message?", undefined, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await supabase.from("group_messages").delete().eq("id", m.id);
            setMessages((prev) => prev?.filter((x) => x.id !== m.id) ?? null);
          },
        },
      ]);
      return;
    }
    openSafetyMenu({
      ministryId,
      me,
      targetType: "group_message",
      targetId: m.id,
      authorId: m.profile_id,
      authorName: names.get(m.profile_id),
      onBlocked: load,
    });
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={{ color: c.muted, textAlign: "center", transform: [{ scaleY: -1 }] }}>No messages yet. Say hello to your brothers.</Text>}
          renderItem={({ item: m }) => {
            const mine = m.profile_id === me;
            return (
              <Pressable
                onLongPress={() => onLongPress(m)}
                accessibilityHint="Long press for options"
                style={[styles.bubble, mine ? [styles.mine, { backgroundColor: c.navy }] : { backgroundColor: c.field, borderColor: c.border, borderWidth: 1 }]}
              >
                {!mine ? <Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>{names.get(m.profile_id) ?? "Former member"}</Text> : null}
                <Text style={{ color: c.text, fontSize: 16, lineHeight: 21 }}>{m.body}</Text>
                <Text style={{ color: c.muted, fontSize: 11, alignSelf: "flex-end" }}>{timeAgo(new Date(m.created_at))}</Text>
              </Pressable>
            );
          }}
        />
        <View style={[styles.composer, { borderTopColor: c.border, backgroundColor: c.bg }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message your group"
            placeholderTextColor={c.muted}
            multiline
            accessibilityLabel="Message"
            style={[styles.input, { color: c.text, backgroundColor: c.field, borderColor: c.border }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={sending || !draft.trim()}
            onPress={send}
            style={[styles.send, { backgroundColor: c.accent, opacity: sending || !draft.trim() ? 0.5 : 1 }]}
          >
            <Text style={{ color: c.onAccent, fontWeight: "700" }}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 12, gap: 8 },
  bubble: { maxWidth: "85%", borderRadius: 14, padding: 10, gap: 2, alignSelf: "flex-start" },
  mine: { alignSelf: "flex-end" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 },
  send: { borderRadius: 20, paddingHorizontal: 18, height: 44, justifyContent: "center" },
});
