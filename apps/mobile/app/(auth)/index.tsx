import { router } from "expo-router";
import { Body, Button, Screen, Title } from "@/components/ui";

export default function Welcome() {
  return (
    <Screen>
      <Title>Man Up</Title>
      <Body muted>Stay connected with your brothers between Saturdays.</Body>
      <Button title="Create account" onPress={() => router.push("/sign-up")} />
      <Button title="Sign in" variant="secondary" onPress={() => router.push("/sign-in")} />
    </Screen>
  );
}
