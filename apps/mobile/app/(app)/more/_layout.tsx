import { Stack } from "expo-router";
import { useAuth } from "@/lib/auth";
import { stackScreenOptions } from "@/lib/navigation";

// Keep the More menu behind destinations opened from Home or a deep link.
export const unstable_settings = { anchor: "index" };

export default function MoreLayout() {
  const { state } = useAuth();
  const isAdmin = state.status === "ready" && state.membership.role === "admin";

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "More" }} />
      <Stack.Screen name="courses/index" options={{ title: "Courses" }} />
      <Stack.Screen name="courses/[courseId]/index" options={{ title: "Course" }} />
      <Stack.Screen name="courses/[courseId]/[lessonId]" options={{ title: "Lesson" }} />
      <Stack.Screen name="serve/index" options={{ title: "Serve" }} />
      <Stack.Screen name="serve/[opportunityId]" options={{ title: "Serve" }} />
      <Stack.Screen name="progress" options={{ title: "My Progress" }} />
      <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
      <Stack.Screen name="settings/leader-sees" options={{ title: "What your leader sees" }} />
      <Stack.Screen name="settings/blocked" options={{ title: "Blocked men" }} />
      <Stack.Screen name="settings/delete-account" options={{ title: "Delete account" }} />

      {/* Ministry admins only: the few admin tasks that can't wait for a desk. */}
      <Stack.Protected guard={isAdmin}>
        <Stack.Screen name="admin/index" options={{ title: "Ministry admin" }} />
        <Stack.Screen name="admin/new-group" options={{ title: "New group" }} />
        <Stack.Screen name="admin/[groupId]" options={{ title: "Group" }} />
      </Stack.Protected>
    </Stack>
  );
}
