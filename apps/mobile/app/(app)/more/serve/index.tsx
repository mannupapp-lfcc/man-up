import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { Body, Button, Card, Loading, Screen, useColors } from "@/components/ui";
import { useServe } from "@/lib/serve";

export default function Serve() {
  const c = useColors();
  const { state, reload } = useServe();
  if (state.status === "loading") return <Loading />;
  if (state.status === "error")
    return (
      <Screen>
        <Body>Could not load serve opportunities.</Body>
        <Button title="Try again" onPress={() => void reload()} />
      </Screen>
    );

  return (
    <Screen>
      {state.myServeCount > 0 ? (
        <Body muted>You have served {state.myServeCount} {state.myServeCount === 1 ? "time" : "times"}. Thank you.</Body>
      ) : null}
      {state.opportunities.length === 0 ? <Body muted>No serve opportunities listed right now.</Body> : null}
      {state.opportunities.map((o) => {
        const claim = state.claims.get(o.id);
        return (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/more/serve/[opportunityId]", params: { opportunityId: o.id } })}
          >
            <Card title={o.title}>
              {o.when ? <Body muted>{o.when}</Body> : null}
              {claim ? <Text style={{ color: c.accent, fontWeight: "700" }}>Your group is serving</Text> : null}
              {!o.open ? <Text style={{ color: c.muted }}>Sign-up closed</Text> : null}
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}
