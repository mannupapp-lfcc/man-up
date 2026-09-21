import { Body, Card, Screen, Title } from "./ui";

// Placeholder for a screen whose feature ships in a later build slice.
export function ComingSoon({ title, children, slice }: { title: string; children: string; slice: number }) {
  return (
    <Screen>
      <Title>{title}</Title>
      <Card>
        <Body>{children}</Body>
        <Body muted>Coming soon (build step {slice}).</Body>
      </Card>
    </Screen>
  );
}
