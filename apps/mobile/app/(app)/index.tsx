import { Body, Button, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";

// Placeholder home until My Group (slice 4).
export default function Home() {
  const { state, signOut } = useAuth();
  if (state.status !== "ready") return null;
  return (
    <Screen>
      <Title>Welcome, {state.fullName.split(" ")[0]}</Title>
      <Body muted>{state.membership.ministryName}</Body>
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
