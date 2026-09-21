import { useState } from "react";
import { Button, ErrorText, Field, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError(await signIn(email, password));
    setBusy(false);
  }

  return (
    <Screen>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
        autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry
        autoCapitalize="none" autoCorrect={false} autoComplete="current-password" textContentType="password" />
      <ErrorText>{error}</ErrorText>
      <Button title="Sign in" onPress={submit} busy={busy} />
    </Screen>
  );
}
