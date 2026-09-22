import { COMMUNITY_GUIDELINES, PRIVACY_POLICY } from "@manup/shared";
import { Stack, useLocalSearchParams } from "expo-router";
import { Body, Card, Screen, Title } from "@/components/ui";

const DOCS = { guidelines: COMMUNITY_GUIDELINES, privacy: PRIVACY_POLICY } as const;

// Community guidelines and privacy policy. Outside every guard in the root layout, so
// they open from sign-up (signed out) and from Settings (signed in). Same text as the
// admin site's /guidelines and /privacy.
export default function LegalDoc() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = DOCS[doc as keyof typeof DOCS] ?? COMMUNITY_GUIDELINES;
  return (
    <Screen>
      <Stack.Screen options={{ title: d.title }} />
      <Title>{d.title}</Title>
      <Body muted>Updated {d.updated}</Body>
      <Body>{d.intro}</Body>
      {d.sections.map((s) => (
        <Card key={s.heading} title={s.heading}>
          {s.paragraphs.map((p) => <Body key={p}>{p}</Body>)}
        </Card>
      ))}
    </Screen>
  );
}
