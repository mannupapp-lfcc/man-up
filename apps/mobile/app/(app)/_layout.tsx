import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useEffect, type ComponentProps } from "react";
import type { ColorValue } from "react-native";
import { useAuth } from "@/lib/auth";
import { registerForPush, usePushResponses } from "@/lib/notifications";
import { colors } from "@/lib/theme";

type IconName = ComponentProps<typeof Ionicons>["name"];
const icon = (name: IconName) =>
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };

export default function AppLayout() {
  const { state } = useAuth();
  const ministryId = state.status === "ready" ? state.membership.ministryId : null;
  // Signed in: register this phone for pushes and route taps on them.
  useEffect(() => {
    if (ministryId) void registerForPush(ministryId);
  }, [ministryId]);
  usePushResponses();

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
