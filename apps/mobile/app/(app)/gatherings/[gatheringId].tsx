import { useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";
import { Body, Button, Card, Loading, Screen, Title } from "@/components/ui";
import { formatGathering, useGatherings } from "@/lib/gatherings";

// Church Center owns registration and check-in: this screen only links out.
export default function GatheringDetail() {
  const { gatheringId } = useLocalSearchParams<{ gatheringId: string }>();
  const { state } = useGatherings();
  if (state.status === "loading") return <Loading />;
  const g = state.status === "ready" ? [...state.upcoming, ...state.recent].find((x) => x.id === gatheringId) : undefined;
  if (!g)
    return (
      <Screen>
        <Body>This gathering is no longer listed.</Body>
      </Screen>
    );

  return (
    <Screen>
      <Title>{g.title}</Title>
      {g.canceled ? <Body>This gathering was canceled.</Body> : null}
      <Card>
        <Body>{formatGathering(g)}</Body>
        {g.location ? <Body muted>{g.location}</Body> : null}
      </Card>
      {g.churchCenterUrl && !g.canceled ? (
        <Button title="Open in Church Center" onPress={() => void Linking.openURL(g.churchCenterUrl!)} />
      ) : null}
      <Card title="Before you come">
        <Body muted>Topic, teacher, and questions to think about will show here (build step 6).</Body>
      </Card>
    </Screen>
  );
}
