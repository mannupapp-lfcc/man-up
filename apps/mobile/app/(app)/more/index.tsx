import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";

type Item = { href: Href; label: string; icon: ComponentProps<typeof Ionicons>["name"] };

const ITEMS: Item[] = [
  { href: "/more/courses", label: "Courses", icon: "book-outline" },
  { href: "/more/serve", label: "Serve", icon: "hammer-outline" },
  { href: "/more/progress", label: "My Progress", icon: "trending-up-outline" },
  { href: "/more/settings", label: "Settings", icon: "settings-outline" },
];

export default function More() {
  const { state } = useAuth();
  const isAdmin = state.status === "ready" && state.membership.role === "admin";
  const items: Item[] = isAdmin ? [...ITEMS, { href: "/more/admin", label: "Ministry admin", icon: "shield-outline" }] : ITEMS;

  return (
    <Screen>
      <View style={styles.list}>
        {items.map((item) => (
          <Row key={item.label} {...item} />
        ))}
      </View>
    </Screen>
  );
}

function Row({ href, label, icon }: Item) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.row, { backgroundColor: c.field, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}
    >
      <Ionicons name={icon} size={22} color={c.accent} />
      <Text style={{ color: c.text, fontSize: 17, flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderRadius: 12, padding: 16, minHeight: 56 },
});
