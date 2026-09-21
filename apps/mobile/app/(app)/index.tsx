import { router } from "expo-router";
import { Body, Button, Card, Screen, Title } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { formatMeeting, useMyGroup } from "@/lib/group";

export default function Home() {
  const { state, signOut } = useAuth();
  const { state: group } = useMyGroup();
  if (state.status !== "ready") return null;

  const next = group.status === "ready" ? group.group?.upcoming[0] : undefined;

  return (
    <Screen>
      <Title>Welcome, {state.fullName.split(" ")[0]}</Title>
      <Body muted>{state.membership.ministryName}</Body>

      {group.status === "ready" && !group.group ? (
        <Card title="Get connected to a group">
          <Body>
            Groups of 4 to 8 men meet every week. A ministry leader will place you in a group soon.
          </Body>
        </Card>
      ) : null}

      {group.status === "ready" && group.group ? (
        <Card title="My Group">
          <Body>{group.group.name}</Body>
          <Body muted>{next ? `Next meeting: ${formatMeeting(next.meetingAt)}` : "No meetings scheduled yet."}</Body>
          <Button title="Open My Group" variant="secondary" onPress={() => router.push("/group")} />
        </Card>
      ) : null}

      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} />
    </Screen>
  );
}
