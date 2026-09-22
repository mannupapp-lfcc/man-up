import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Linking, StyleSheet, Switch, Text, View } from "react-native";
import { Body, Button, Card, Loading, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Key = "group_chat" | "ministry_posts" | "meeting_reminders" | "weekly_questions" | "checkin_prompts";
type Values = Record<Key, boolean>;

const OPTIONS: { key: Key; label: string; hint: string }[] = [
  { key: "group_chat", label: "Group chat", hint: "New messages in your group." },
  { key: "ministry_posts", label: "Ministry announcements", hint: "When a leader posts @everyone in the ministry chat." },
  { key: "meeting_reminders", label: "Meeting reminders", hint: "A few hours before your group meets." },
  { key: "weekly_questions", label: "Weekly questions", hint: "When this week's discussion questions are ready." },
  { key: "checkin_prompts", label: "Weekly check-in", hint: "A midweek nudge to tell your group how you are doing." },
];

const ALL_ON: Values = { group_chat: true, ministry_posts: true, meeting_reminders: true, weekly_questions: true, checkin_prompts: true };

// Which optional pushes he gets. Tags always come through (someone is talking to
// him), and so do leaders' attendance reminders and Monday digests.
export default function NotificationSettings() {
  const c = useColors();
  const { state } = useAuth();
  const me = state.status === "ready" ? state.session.user.id : null;
  const ministryId = state.status === "ready" ? state.membership.ministryId : null;
  const [values, setValues] = useState<Values | null>(null);

  const load = useCallback(async () => {
    if (!me || !ministryId) return;
    const { data } = await supabase.from("notification_settings").select("*").eq("ministry_id", ministryId).eq("profile_id", me).maybeSingle();
    setValues(data ? { group_chat: data.group_chat, ministry_posts: data.ministry_posts, meeting_reminders: data.meeting_reminders,
      weekly_questions: data.weekly_questions, checkin_prompts: data.checkin_prompts } : ALL_ON);
  }, [me, ministryId]);
  useFocusEffect(useCallback(() => void load(), [load]));

  if (!values || !me || !ministryId) return <Loading />;

  const toggle = async (key: Key, on: boolean) => {
    const next = { ...values, [key]: on };
    setValues(next);
    const { error } = await supabase.from("notification_settings")
      .upsert({ ministry_id: ministryId, profile_id: me, ...next, updated_at: new Date().toISOString() });
    if (error) {
      Alert.alert("Not saved", error.message);
      void load();
    }
  };

  return (
    <Screen>
      <Card>
        {OPTIONS.map((o) => (
          <View key={o.key} style={styles.row}>
            <View style={styles.flex}>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{o.label}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{o.hint}</Text>
            </View>
            <Switch value={values[o.key]} onValueChange={(on) => void toggle(o.key, on)} accessibilityLabel={o.label}
              trackColor={{ true: c.accent, false: c.border }} thumbColor={c.text} />
          </View>
        ))}
      </Card>
      <Body muted>When someone tags you, you always hear about it. If nothing comes through at all, notifications may be off for Man Up on this phone.</Body>
      <Button title="Open phone settings" variant="secondary" onPress={() => void Linking.openSettings()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  flex: { flex: 1, gap: 2 },
});
