import { useState } from "react";
import { Body, Button, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function Offline() {
  const { retry, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <Title>Can't connect</Title>
      <Body muted>We could not reach Man Up. Check your connection and try again.</Body>
      <Button title="Try again" busy={busy} onPress={async () => { setBusy(true); await retry(); setBusy(false); }} />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
