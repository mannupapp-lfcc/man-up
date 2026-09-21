import { useState, type ReactNode, type ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";

// Components read colors through this hook so screens stay theme-agnostic.
export function useColors() {
  return {
    bg: colors.bg,
    text: colors.text,
    muted: colors.muted,
    border: colors.border,
    field: colors.surface,
    navy: colors.navy,
    accent: colors.gold,
    onAccent: colors.onGold,
    error: colors.error,
  };
}

export function Screen({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.bg }]} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{children}</Text>;
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
  const [focused, setFocused] = useState(false);
  const { style, onFocus, onBlur, ...rest } = input;
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        style={[styles.input, { color: c.text, backgroundColor: c.field, borderColor: focused ? c.accent : c.border }, style]}
        selectionColor={c.accent}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        accessibilityLabel={label}
        {...rest}
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
        primary ? { backgroundColor: c.accent } : { backgroundColor: c.navy, borderColor: c.border, borderWidth: 1 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        busy && { opacity: 0.6 },
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
      <ActivityIndicator color={c.accent} accessibilityLabel="Loading" />
    </View>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function ActionRow({ title, subtitle, icon, href }: {
  title: string; subtitle: string; icon: ComponentProps<typeof Ionicons>["name"]; href: Href;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href, { withAnchor: true })}
      style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.8 }]}>
      <View style={styles.iconBadge}><Ionicons name={icon} size={23} color={colors.gold} /></View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.hint}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 20, paddingTop: 24, paddingBottom: 32, gap: 20, flexGrow: 1, width: "100%", maxWidth: 640, alignSelf: "center" },
  title: { fontSize: 32, lineHeight: 39, fontWeight: "800", letterSpacing: -0.9 },
  eyebrow: { color: colors.gold, fontSize: 11, lineHeight: 17, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  body: { fontSize: 16, lineHeight: 25 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  hint: { fontSize: 13, lineHeight: 19, color: colors.muted },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15, minHeight: 54, fontSize: 16 },
  button: { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 16, alignItems: "center", minHeight: 54, justifyContent: "center" },
  buttonText: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  card: { borderWidth: 1, borderRadius: 22, padding: 20, gap: 12, borderTopWidth: 2, shadowColor: colors.navy, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 4 },
  cardTitle: { fontSize: 17, lineHeight: 23, fontWeight: "700", color: colors.text },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18, minHeight: 88 },
  iconBadge: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" },
});
