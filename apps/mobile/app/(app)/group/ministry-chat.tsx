import { useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { openSafetyMenu } from "@/components/safety";
import { Body, Button, Loading, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useMinistryChat, type MinistryMessage, type Person } from "@/lib/ministryChat";
import { timeAgo } from "@/lib/pray";

// The "@name" he is typing at the end of the draft, if any.
const TAG_QUERY = /(^|\s)@([^@\n]{0,30})$/;

// Ministry chat: every man in the ministry. Type @ to tag a brother; a tag alerts
// him, and a leader's post alerts everyone (the push itself ships with slice 9).
export default function MinistryChat() {
  const c = useColors();
  const { state: auth } = useAuth();
  const { messages, people, error, reload, send, remove } = useMinistryChat();
  const me = auth.status === "ready" ? auth.session.user.id : null;
  const ministryId = auth.status === "ready" ? auth.membership.ministryId : null;
  const [draft, setDraft] = useState("");
  const [tagged, setTagged] = useState<Map<string, string>>(new Map());
  const [sending, setSending] = useState(false);

  if (error && messages === null)
    return (
      <Screen>
        <Body>Could not load the ministry chat. Check your connection.</Body>
        <Button title="Try again" onPress={() => void reload()} />
      </Screen>
    );
  if (!me || !ministryId || messages === null) return <Loading />;

  const query = TAG_QUERY.exec(draft)?.[2]?.toLowerCase();
  const suggestions =
    query === undefined
      ? []
      : [...people.entries()]
          .filter(([id, p]) => id !== me && p.name.toLowerCase().includes(query) && !draft.endsWith(`@${p.name}`))
          .slice(0, 5);

  function pick(id: string, name: string) {
    setDraft((d) => d.replace(/@([^@\n]{0,30})$/, `@${name} `));
    setTagged((t) => new Map(t).set(id, name));
  }

  async function onSend() {
    const body = draft.trim();
    if (!body) return;
    // Keep only tags whose @name is still in the text.
    const mentions = [...tagged].filter(([, name]) => body.includes(`@${name}`)).map(([id]) => id);
    setSending(true);
    const err = await send(body, mentions);
    setSending(false);
    if (err) return Alert.alert("Not sent", err);
    setDraft("");
    setTagged(new Map());
  }

  function onLongPress(m: MinistryMessage) {
    if (!me || !ministryId) return;
    if (m.profile_id === me) {
      Alert.alert("Delete this message?", undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => void remove(m.id) },
      ]);
      return;
    }
    openSafetyMenu({
      ministryId,
      me,
      targetType: "ministry_message",
      targetId: m.id,
      authorId: m.profile_id,
      authorName: people.get(m.profile_id)?.name,
      onBlocked: reload,
    });
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={{ color: c.muted, textAlign: "center", transform: [{ scaleY: -1 }] }}>
              No messages yet. Say hello to the brothers.
            </Text>
          }
          renderItem={({ item: m }) => {
            const mine = m.profile_id === me;
            const author = people.get(m.profile_id);
            const forMe = m.mentions.includes(me);
            return (
              <Pressable
                onLongPress={() => onLongPress(m)}
                accessibilityHint="Long press for options"
                style={[
                  styles.bubble,
                  mine ? [styles.mine, { backgroundColor: c.navy }] : { backgroundColor: c.field, borderColor: c.border, borderWidth: 1 },
                  forMe && { borderColor: c.accent, borderWidth: 1, borderLeftWidth: 4 },
                ]}
              >
                {!mine ? (
                  <View style={styles.author}>
                    <Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>{author?.name ?? "Former member"}</Text>
                    {author?.isLeader ? <Text style={[styles.badge, { color: c.onAccent, backgroundColor: c.accent }]}>Leader</Text> : null}
                  </View>
                ) : null}
                <MessageBody message={m} people={people} />
                <Text style={{ color: c.muted, fontSize: 11, alignSelf: "flex-end" }}>{timeAgo(new Date(m.created_at))}</Text>
              </Pressable>
            );
          }}
        />
        {suggestions.length ? (
          <View style={[styles.suggestions, { borderTopColor: c.border, backgroundColor: c.field }]}>
            {suggestions.map(([id, p]) => (
              <Pressable key={id} accessibilityRole="button" accessibilityLabel={`Tag ${p.name}`} onPress={() => pick(id, p.name)} style={styles.suggestion}>
                <Text style={{ color: c.text, fontSize: 16 }}>@{p.name}</Text>
                {p.isLeader ? <Text style={{ color: c.muted, fontSize: 13 }}>Leader</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={[styles.composer, { borderTopColor: c.border, backgroundColor: c.bg }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the ministry. Type @ to tag."
            placeholderTextColor={c.muted}
            multiline
            accessibilityLabel="Message"
            style={[styles.input, { color: c.text, backgroundColor: c.field, borderColor: c.border }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={sending || !draft.trim()}
            onPress={onSend}
            style={[styles.send, { backgroundColor: c.accent, opacity: sending || !draft.trim() ? 0.5 : 1 }]}
          >
            <Text style={{ color: c.onAccent, fontWeight: "700" }}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// The text with each real tag (@name of a man in m.mentions) in gold.
function MessageBody({ message, people }: { message: MinistryMessage; people: Map<string, Person> }) {
  const c = useColors();
  const names = message.mentions
    .map((id) => people.get(id)?.name)
    .filter((n): n is string => !!n)
    .sort((a, b) => b.length - a.length)
    .map((n) => `@${n}`);
  const parts = names.length
    ? message.body.split(new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`))
    : [message.body];
  return (
    <Text style={{ color: c.text, fontSize: 16, lineHeight: 21 }}>
      {parts.map((part, i) =>
        names.includes(part) ? (
          <Text key={i} style={{ color: c.accent, fontWeight: "700" }}>{part}</Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 12, gap: 8 },
  bubble: { maxWidth: "85%", borderRadius: 14, padding: 10, gap: 2, alignSelf: "flex-start" },
  mine: { alignSelf: "flex-end" },
  author: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { fontSize: 10, fontWeight: "800", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, overflow: "hidden" },
  suggestions: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 4 },
  suggestion: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, maxHeight: 120 },
  send: { borderRadius: 20, paddingHorizontal: 18, height: 44, justifyContent: "center" },
});
