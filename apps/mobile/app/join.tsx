import { useState } from "react";
import { Button, Body, ErrorText, Field, Screen, Title } from "@/components/ui";
import { useJoinChoice } from "@/components/JoinChoicePicker";
import { useAuth } from "@/lib/auth";

// Signed in, but not a member of any ministry yet (for example, account creation
// finished but joining did not).
export default function Join() {
  const { state, join, signOut } = useAuth();
  const joinChoice = useJoinChoice();
  const session = state.status === "needsMinistry" ? state.session : null;
  const metaName = session?.user.user_metadata?.full_name;
  const [fullName, setFullName] = useState(typeof metaName === "string" ? metaName : "");
  const [error, setError] = useState<string | null>(state.status === "needsMinistry" ? (state.error ?? null) : null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!fullName.trim()) return setError("Enter your name.");
    setBusy(true);
    const resolved = await joinChoice.resolve();
    const err = "error" in resolved ? resolved.error : await join(fullName, resolved.choice);
    if (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>One more step</Title>
      <Body muted>Signed in as {session?.user.email}. Choose where you belong.</Body>
      <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
      {joinChoice.element}
      <ErrorText>{error}</ErrorText>
      <Button title="Continue" onPress={submit} busy={busy || !joinChoice.ready} />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
