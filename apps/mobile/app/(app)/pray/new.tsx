import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Body, Button, ErrorText, Field, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useMyGroup } from "@/lib/group";
import { postRequest, type Visibility } from "@/lib/pray";

export default function NewPrayerRequest() {
  const c = useColors();
  const { state: auth } = useAuth();
  const { state: group } = useMyGroup();
  const groupId = group.status === "ready" ? group.group?.groupId ?? null : null;
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [choice, setChoice] = useState<Visibility | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Default: his group. A man with no group yet can share with the ministry.
  const visibility: Visibility = choice ?? (groupId ? "group" : "ministry");
  if (auth.status !== "ready") return null;

  async function submit() {
    if (auth.status !== "ready") return;
    if (!body.trim()) return setError("Write your request first.");
    setBusy(true);
    const err = await postRequest({
      ministryId: auth.membership.ministryId,
      me: auth.session.user.id,
      body,
      anonymous,
      visibility,
      groupId,
    });
    if (err) {
      setBusy(false);
      return setError(err);
    }
    router.back();
  }

  const Option = ({ value, label, hint, disabled }: { value: Visibility; label: string; hint: string; disabled?: boolean }) => {
    const on = visibility === value;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ checked: on, disabled: !!disabled }}
        disabled={disabled}
        onPress={() => setChoice(value)}
        style={[styles.option, { borderColor: on ? c.accent : c.border, opacity: disabled ? 0.5 : 1 }]}
      >
        <Text style={{ color: c.text, fontSize: 16, fontWeight: "600" }}>{label}</Text>
        <Text style={{ color: c.muted, fontSize: 13 }}>{hint}</Text>
      </Pressable>
    );
  };

  return (
    <Screen>
      <Field label="Your request" value={body} onChangeText={setBody} multiline numberOfLines={5}
        style={{ minHeight: 120, textAlignVertical: "top" }} placeholder="What can your brothers pray about?" />
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "600" }}>Who sees it</Text>
      <Option value="group" label="My group" hint={groupId ? "Only the men in your group" : "Join a group to share with one"} disabled={!groupId} />
      <Option value="ministry" label="Whole ministry" hint="Every man in the ministry, including leaders" />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={{ color: c.text, fontSize: 16 }}>Post anonymously</Text>
          <Body muted>No one will see your name.</Body>
        </View>
        <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: c.accent, false: c.border }} />
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title="Share" onPress={submit} busy={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { borderWidth: 2, borderRadius: 10, padding: 12, gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
});
