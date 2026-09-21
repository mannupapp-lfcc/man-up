import { Stack } from "expo-router";
import { stackScreenOptions } from "@/lib/navigation";

export default function GatheringsLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "Gatherings" }} />
      <Stack.Screen name="[gatheringId]" options={{ title: "Gathering" }} />
    </Stack>
  );
}
