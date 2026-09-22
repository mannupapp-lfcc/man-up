import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { Body, Button, Card, ErrorText, Field, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";

// Store requirement: a man can delete his account in the app. Everything that is his
// goes with it (0015); attendance he marked for other men stays without his name.
export default function DeleteAccount() {
  const { deleteAccount } = useAuth();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = confirm.trim().toUpperCase() === "DELETE";

  const run = () =>
    Alert.alert("Delete your account?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          setBusy(true);
          const message = await deleteAccount();
          setBusy(false);
          if (message) setError(message);
        },
      },
    ]);

  return (
    <Screen>
      <Title>Delete account</Title>
      <Card title="What gets deleted">
        <Body>Your account and profile, and your place in the ministry and your group.</Body>
        <Body>Everything you posted: chat messages, prayer requests, check-ins, and lesson reflections.</Body>
        <Body>Your attendance, progress, and anything your leader logged about you.</Body>
      </Card>
      <Card title="What stays">
        <Body muted>If you were a leader, attendance you marked for other men stays in their records, without your name.</Body>
        <Body muted>Your Planning Center record at the church is not affected. This app never changes it.</Body>
      </Card>
      <Body>This happens right away and cannot be undone. If you only need a break, you can turn notifications off instead.</Body>
      <Button title="Notification settings" variant="secondary" onPress={() => router.replace("/more/settings/notifications")} />
      <Field label='Type DELETE to confirm' value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} />
      <ErrorText>{error}</ErrorText>
      <Button title="Delete my account" onPress={() => (ready ? run() : setError("Type DELETE to confirm."))} busy={busy} />
    </Screen>
  );
}
