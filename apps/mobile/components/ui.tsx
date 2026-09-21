import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function useColors() {
  const dark = useColorScheme() === "dark";
  return {
    bg: dark ? "#0f1115" : "#ffffff",
    text: dark ? "#f2f2f2" : "#15171a",
    muted: dark ? "#9aa0a6" : "#5f6368",
    border: dark ? "#2c2f36" : "#d0d4d9",
    field: dark ? "#181b21" : "#f6f7f9",
    accent: dark ? "#6ea8ff" : "#1f5fd1",
    onAccent: "#ffffff",
    error: dark ? "#ff8a80" : "#b3261e",
  };
}

export function Screen({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.title, { color: c.text }]}>{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const c = useColors();
  return <Text style={[styles.body, { color: muted ? c.muted : c.text }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const c = useColors();
  if (!children) return null;
  return (
    <Text accessibilityRole="alert" style={[styles.body, { color: c.error }]}>
      {children}
    </Text>
  );
}

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        style={[styles.input, { color: c.text, backgroundColor: c.field, borderColor: c.border }]}
        accessibilityLabel={label}
        {...input}
      />
      {hint ? <Text style={[styles.hint, { color: c.muted }]}>{hint}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  busy,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "secondary";
}) {
  const c = useColors();
  const primary = variant === "primary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!busy }}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: c.accent } : { borderColor: c.border, borderWidth: 1 },
        (pressed || busy) && { opacity: 0.7 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? c.onAccent : c.text} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? c.onAccent : c.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.card, { borderColor: c.border, backgroundColor: c.field }]}>
      {title ? <Text style={[styles.cardTitle, { color: c.text }]}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={[styles.flex, styles.center, { backgroundColor: c.bg }]}>
      <ActivityIndicator color={c.text} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 24, gap: 16, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 22 },
  field: { gap: 6 },
  label: { fontSize: 15, fontWeight: "600" },
  hint: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: "center", minHeight: 48, justifyContent: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: "700" },
});
