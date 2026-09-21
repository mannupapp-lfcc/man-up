import { Stack } from "expo-router";
import { GroupProvider, useGroup } from "@/lib/group";
import { stackScreenOptions } from "@/lib/navigation";

export default function GroupLayout() {
  return (
    <GroupProvider>
      <GroupStack />
    </GroupProvider>
  );
}

function GroupStack() {
  const { state } = useGroup();
  const group = state.status === "ready" ? state.group : null;

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="index" options={{ title: "My Group" }} />

      {/* Group sections: only once he is placed in a group. */}
      <Stack.Protected guard={!!group}>
        <Stack.Screen name="chat" options={{ title: "Chat" }} />
        <Stack.Screen name="meetings" options={{ title: "Meetings" }} />
        <Stack.Screen name="questions" options={{ title: "Questions" }} />
        <Stack.Screen name="roster" options={{ title: "Roster" }} />
      </Stack.Protected>

      {/* Leader tools: only for the leader or co-leader of this group. The database
          enforces the same rule (fn_leads_group); this keeps the screens out of reach. */}
      <Stack.Protected guard={!!group?.iLead}>
        <Stack.Screen name="(leaders)/attendance/[meetingId]" options={{ title: "Mark attendance" }} />
        <Stack.Screen name="(leaders)/dashboard" options={{ title: "Leader dashboard" }} />
      </Stack.Protected>
    </Stack>
  );
}
