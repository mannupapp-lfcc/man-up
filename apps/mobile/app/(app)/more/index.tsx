import Ionicons from "@expo/vector-icons/Ionicons";
import type { Href } from "expo-router";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { ActionRow, Body, Eyebrow, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";

type Item = { href: Href; label: string; subtitle: string; icon: ComponentProps<typeof Ionicons>["name"] };

const ITEMS: Item[] = [
  { href: "/more/courses", label: "Courses", subtitle: "Build your faith, one lesson at a time.", icon: "book-outline" },
  { href: "/more/serve", label: "Serve", subtitle: "Find a way to make a difference.", icon: "hammer-outline" },
  { href: "/more/progress", label: "My Progress", subtitle: "Reflect on your journey and growth.", icon: "trending-up-outline" },
  { href: "/more/settings", label: "Settings", subtitle: "Your account, privacy, and preferences.", icon: "settings-outline" },
];

export default function More() {
  const { state } = useAuth();
  const isAdmin = state.status === "ready" && state.membership.role === "admin";
  const items: Item[] = isAdmin ? [...ITEMS, { href: "/more/admin", label: "Ministry admin", subtitle: "Tools to care for your ministry.", icon: "shield-outline" }] : ITEMS;

  return (
    <Screen>
      <Eyebrow>Live with purpose</Eyebrow>
      <Title>Keep moving forward.</Title>
      <Body muted>Grow in faith, serve others, and stay connected.</Body>
      <View style={{ gap: 12 }}>
        {items.map((item) => (
          <ActionRow key={item.label} title={item.label} subtitle={item.subtitle} icon={item.icon} href={item.href} />
        ))}
      </View>
    </Screen>
  );
}
