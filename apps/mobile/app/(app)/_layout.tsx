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
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        // Let the navigator size icons, labels, and system navigation insets.
        // Extra padding here squeezes the fixed-height tab content on Android.
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerShadowVisible: false,
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
