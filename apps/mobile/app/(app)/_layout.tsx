import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { colors } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", headerShown: true, headerStyle: { backgroundColor: colors.bg }, headerTitleStyle: { color: colors.text }, tabBarIcon: icon("home-outline") }} />
      <Tabs.Screen name="gatherings" options={{ title: "Gatherings", tabBarIcon: icon("calendar-outline") }} />
      <Tabs.Screen name="group" options={{ title: "My Group", tabBarIcon: icon("people-outline") }} />
      <Tabs.Screen name="pray" options={{ title: "Pray", tabBarIcon: icon("heart-outline") }} />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: icon("menu-outline") }} />
    </Tabs>
  );
}
