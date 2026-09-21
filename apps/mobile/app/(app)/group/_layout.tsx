import { Stack } from "expo-router";
import { useColors } from "@/components/ui";

export default function GroupLayout() {
  const c = useColors();
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: c.bg }, headerTintColor: c.text }}>
      <Stack.Screen name="index" options={{ title: "My Group" }} />
      <Stack.Screen name="meeting/[id]" options={{ title: "Mark attendance" }} />
    </Stack>
  );
}
