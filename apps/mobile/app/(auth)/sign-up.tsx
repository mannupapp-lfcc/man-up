import { router } from "expo-router";
import { useState } from "react";
import { Text } from "react-native";
import { Button, ErrorText, Field, Screen } from "@/components/ui";
import { useJoinChoice } from "@/components/JoinChoicePicker";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/theme";

export default function SignUp() {
  const { signUp } = useAuth();
  const joinChoice = useJoinChoice();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!fullName.trim()) return setError("Enter your name.");
    if (!email.trim()) return setError("Enter your email.");
    if (password.length < 8) return setError("Use a password with at least 8 characters.");
    setBusy(true);
    const resolved = await joinChoice.resolve();
    if ("error" in resolved) {
      setBusy(false);
      return setError(resolved.error);
    }
    const err = await signUp({ fullName, email, password, phone: phone.trim() || undefined, join: resolved.choice });
    // On success the app moves on by itself; this screen may already be gone.
    if (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Field label="Full name" value={fullName} onChangeText={setFullName}
        autoComplete="name" textContentType="name" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none"
        autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Phone (optional)" hint="Your group can reach you here." value={phone}
        onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
      <Field label="Password" hint="At least 8 characters." value={password} onChangeText={setPassword}
        secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" textContentType="newPassword" />
      {joinChoice.element}
      <ErrorText>{error}</ErrorText>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
        By creating an account you agree to the{" "}
        <Text style={{ color: colors.gold }} onPress={() => router.push("/legal/guidelines")}>Community Guidelines</Text> and{" "}
        <Text style={{ color: colors.gold }} onPress={() => router.push("/legal/privacy")}>Privacy Policy</Text>.
      </Text>
      <Button title="Create account" onPress={submit} busy={busy || !joinChoice.ready} />
    </Screen>
  );
}
