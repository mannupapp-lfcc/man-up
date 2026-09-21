import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { Body, Button, Card, ErrorText, Field, Loading, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { saveProgress, useLesson } from "@/lib/content";

export default function LessonScreen() {
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { state: auth } = useAuth();
  const { state, reload } = useLesson(lessonId);
  const [reflection, setReflection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (state.status === "ready" && reflection === null) setReflection(state.data.reflection);
  }, [state, reflection]);

  if (state.status === "loading" || auth.status !== "ready") return <Loading />;
  if (state.status === "error") return <Screen><Body>This lesson is not available.</Body></Screen>;
  const l = state.data;

  async function save(complete: boolean) {
    if (auth.status !== "ready") return;
    setBusy(true);
    setError(null);
    const err = await saveProgress({
      ministryId: auth.membership.ministryId,
      me: auth.session.user.id,
      lessonId,
      reflection: reflection ?? "",
      complete,
    });
    setBusy(false);
    if (err) return setError(err);
    setNotice(complete ? "Lesson complete." : "Saved.");
    void reload();
  }

  return (
    <Screen>
      <Title>{l.title}</Title>
      {l.videoUrl ? <Button title="Watch the video" onPress={() => void Linking.openURL(l.videoUrl!)} /> : null}
      {l.scriptureRef ? (
        <Card title={l.scriptureRef}>{l.scriptureText ? <Body>{l.scriptureText}</Body> : null}</Card>
      ) : null}
      {l.body ? <Body>{l.body}</Body> : null}
      {l.questions.length ? (
        <Card title="Reflect">
          {l.questions.map((q, i) => (
            <Body key={i}>{i + 1}. {q}</Body>
          ))}
        </Card>
      ) : null}
      <Field
        label="Your reflection"
        hint="Private to you. No leader or admin can see it."
        value={reflection ?? ""}
        onChangeText={setReflection}
        multiline
        style={{ minHeight: 120, textAlignVertical: "top" }}
      />
      <ErrorText>{error}</ErrorText>
      {notice ? <Body muted>{notice}</Body> : null}
      <Button title="Save reflection" variant="secondary" onPress={() => save(false)} busy={busy} />
      {l.completedAt ? (
        <Body muted>You completed this lesson.</Body>
      ) : (
        <Button title="Mark lesson complete" onPress={() => save(true)} busy={busy} />
      )}
    </Screen>
  );
}
