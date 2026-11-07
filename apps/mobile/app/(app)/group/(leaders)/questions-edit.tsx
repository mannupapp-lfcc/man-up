import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Chip, ErrorText, Field, Loading, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useGroup } from "@/lib/group";
import {
  MAX_QUESTION_LENGTH,
  MAX_QUESTIONS,
  MAX_TITLE_LENGTH,
  loadWeek,
  mondayOf,
  removeQuestions,
  saveQuestions,
  weekLabel,
} from "@/lib/questions";

// Leader only (Stack.Protected on iLead; RLS fn_leads_group): write or change the
// group's discussion questions for this week or next.
export default function EditQuestions() {
  const c = useColors();
  const params = useLocalSearchParams<{ week?: string }>();
  const { state: auth } = useAuth();
  const { state: groupState } = useGroup();
  const group = groupState.status === "ready" ? groupState.group : null;

  const [week, setWeek] = useState<"this" | "next">(params.week === "next" ? "next" : "this");
  const weekOf = mondayOf(new Date(), week === "next" ? 1 : 0);
  const [loaded, setLoaded] = useState<string | null>(null); // weekOf currently in the form
  const [exists, setExists] = useState(false);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groupId = group?.groupId ?? null;
  useEffect(() => {
    if (!groupId) return;
    let live = true;
    void loadWeek(groupId, weekOf).then((r) => {
      if (!live) return;
      if ("error" in r) return setError("Could not load the questions.");
      setExists(!!r.set);
      setTitle(r.set?.title ?? "");
      setQuestions(r.set?.questions.length ? r.set.questions : [""]);
      setError(null);
      setLoaded(weekOf);
    });
    return () => { live = false; };
  }, [groupId, weekOf]);

  if (auth.status !== "ready" || !group) return null;
  if (loaded !== weekOf) return <Loading />;

  const setAt = (i: number, text: string) => setQuestions((qs) => qs.map((q, j) => (j === i ? text : q)));
  const removeAt = (i: number) => setQuestions((qs) => (qs.length > 1 ? qs.filter((_, j) => j !== i) : [""]));

  async function save() {
    if (auth.status !== "ready" || !group) return;
    setBusy(true);
    const err = await saveQuestions({
      ministryId: auth.membership.ministryId,
      groupId: group.groupId,
      me: auth.session.user.id,
      weekOf,
      title,
      questions,
    });
    setBusy(false);
    if (err) return setError(err);
    router.back();
  }

  function confirmRemove() {
    if (!group) return;
    Alert.alert("Remove these questions?", "Your group will not see questions for this week.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          const err = await removeQuestions(group.groupId, weekOf);
          if (err) return setError(err);
          router.back();
        },
      },
    ]);
  }

  return (
    <Screen>
      <View style={styles.row}>
        <Chip label="This week" selected={week === "this"} onPress={() => setWeek("this")} />
        <Chip label="Next week" selected={week === "next"} onPress={() => setWeek("next")} />
      </View>
      <Body muted>Week of {weekLabel(weekOf)}. Only the men in {group.name} see these.</Body>

      <Field
        label="Title (optional)"
        value={title}
        onChangeText={setTitle}
        maxLength={MAX_TITLE_LENGTH}
        placeholder="e.g. Leading at Home"
      />

      {questions.map((q, i) => (
        <View key={i} style={styles.question}>
          <View style={styles.flex}>
            <Field
              label={`Question ${i + 1}`}
              value={q}
              onChangeText={(text) => setAt(i, text)}
              multiline
              maxLength={MAX_QUESTION_LENGTH}
              style={{ minHeight: 64, textAlignVertical: "top" }}
            />
          </View>
          {questions.length > 1 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove question ${i + 1}`} onPress={() => removeAt(i)} hitSlop={8}>
              <Text style={{ color: c.muted, fontSize: 14, fontWeight: "600" }}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {questions.length < MAX_QUESTIONS ? (
        <Pressable accessibilityRole="button" onPress={() => setQuestions((qs) => [...qs, ""])} hitSlop={8}>
          <Text style={{ color: c.accent, fontSize: 16, fontWeight: "600" }}>+ Add a question</Text>
        </Pressable>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button title={exists ? "Save changes" : "Post questions"} onPress={save} busy={busy} />
      {exists ? <Button title="Remove these questions" variant="secondary" onPress={confirmRemove} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  question: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  flex: { flex: 1 },
});
