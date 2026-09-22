import { router } from "expo-router";
import { Body, Button, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function Settings() {
  const { state, signOut } = useAuth();
  if (state.status !== "ready") return null;

  return (
    <Screen>
      <Card title="Account">
        <Body>{state.fullName}</Body>
        <Body muted>{state.session.user.email}</Body>
      </Card>
      <Button title="Notifications" variant="secondary" onPress={() => router.push("/more/settings/notifications")} />
      <Button title="What your leader sees" variant="secondary" onPress={() => router.push("/more/settings/leader-sees")} />
      <Button title="Community guidelines" variant="secondary" onPress={() => router.push("/legal/guidelines")} />
      <Button title="Privacy policy" variant="secondary" onPress={() => router.push("/legal/privacy")} />
      <Button title="Blocked men" variant="secondary" onPress={() => router.push("/more/settings/blocked")} />
      <Button title="Delete account" variant="secondary" onPress={() => router.push("/more/settings/delete-account")} />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
