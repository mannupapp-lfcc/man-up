import { useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";
import { Body, Button, Card, Loading, Screen, Title } from "@/components/ui";
import { useGatheringContent } from "@/lib/content";
import { formatGathering, useGatherings } from "@/lib/gatherings";

// Church Center owns registration and check-in: this screen only links out.
export default function GatheringDetail() {
  const { gatheringId } = useLocalSearchParams<{ gatheringId: string }>();
  const { state } = useGatherings();
  const g = state.status === "ready" ? [...state.upcoming, ...state.recent].find((x) => x.id === gatheringId) : undefined;
  const { state: content } = useGatheringContent(g?.startsAt ?? null);
  if (state.status === "loading") return <Loading />;
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
      {content.status === "ready" && content.data ? (
        <>
          {content.data.topic ? (
            <Card title={content.data.topic}>{content.data.teacher ? <Body muted>With {content.data.teacher}</Body> : null}</Card>
          ) : null}
          {content.data.prework.length ? (
            <Card title="Before you come">
              {content.data.prework.map((q, i) => <Body key={i}>{i + 1}. {q}</Body>)}
            </Card>
          ) : null}
          {content.data.recap ? <Card title="Recap"><Body>{content.data.recap}</Body></Card> : null}
          {content.data.takehome.length ? (
            <Card title="Take home">
              {content.data.takehome.map((q, i) => <Body key={i}>{i + 1}. {q}</Body>)}
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
