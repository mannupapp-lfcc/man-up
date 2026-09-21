import { Stack } from "expo-router";
import { stackScreenOptions } from "@/lib/navigation";

export default function PrayLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Pray" }} />
      <Stack.Screen name="new" options={{ title: "Share a request", presentation: "modal" }} />
    </Stack>
  );
}
