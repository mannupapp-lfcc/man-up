import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";
import { Body, Button, Card, ErrorText, Loading, Screen, Title, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { claimForGroup, confirmServed, setOptIn, unclaim, useServe } from "@/lib/serve";

export default function ServeOpportunity() {
  const { opportunityId } = useLocalSearchParams<{ opportunityId: string }>();
  const c = useColors();
  const { state: auth } = useAuth();
  const { state, reload, group } = useServe();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Set<string> | null>(null);

  if (state.status !== "ready" || auth.status !== "ready") return <Loading />;
  const o = state.opportunities.find((x) => x.id === opportunityId);
  if (!o) return <Screen><Body>This opportunity is no longer listed.</Body></Screen>;

  const me = auth.session.user.id;
  const ministryId = auth.membership.ministryId;
  const claim = state.claims.get(o.id);
  const imIn = !!claim?.optedIn.includes(me);
  const names = new Map(group?.roster.map((m) => [m.profileId, m.fullName]) ?? []);

  const act = async (fn: () => Promise<string | null>) => {
    setError(null);
    const err = await fn();
    if (err) setError(err);
    await reload();
  };

  return (
    <Screen>
      <Title>{o.title}</Title>
      {o.when ? <Body muted>{o.when}</Body> : null}
      {o.description ? <Body>{o.description}</Body> : null}
      {o.url && o.open ? <Button title="Sign up on Church Center" onPress={() => void Linking.openURL(o.url!)} /> : null}
      {!o.open ? <Body muted>Sign-up is closed.</Body> : null}

      {group ? (
        <Card title="Serve together">
          {claim ? (
            <>
              <Body>{group.name} is taking this on together.</Body>
              <Body muted>
                {claim.optedIn.length
                  ? `Going: ${claim.optedIn.map((id) => (id === me ? "You" : names.get(id) ?? "A brother")).join(", ")}`
                  : "No one has said they're in yet."}
              </Body>
              {!claim.confirmedAt ? (
                <Button
                  title={imIn ? "I'm out" : "I'm in"}
                  variant={imIn ? "secondary" : "primary"}
                  onPress={() => act(() => setOptIn(ministryId, claim.id, me, !imIn))}
                />
              ) : (
                <Body muted>Your leader confirmed who served. Thank you.</Body>
              )}
              {imIn && o.url ? <Body muted>Remember to sign up on Church Center too.</Body> : null}
            </>
          ) : group.iLead ? (
            <>
              <Body muted>Take this on as a group. Your men can opt in with one tap.</Body>
              <Button title="Claim for my group" variant="secondary" onPress={() => act(() => claimForGroup(ministryId, group.groupId, o.id, me))} />
            </>
          ) : (
            <Body muted>Ask your leader about serving on this together.</Body>
          )}
        </Card>
      ) : null}

      {group?.iLead && claim && !claim.confirmedAt ? (
        <Card title="Leader">
          {confirming === null ? (
            <>
              <Button title="Confirm who served" onPress={() => setConfirming(new Set(claim.optedIn))} />
              <Button title="Unclaim" variant="secondary" onPress={() => act(() => unclaim(claim.id))} />
            </>
          ) : (
            <>
              <Body muted>Check each man who served.</Body>
              {group.roster.map((m) => {
                const on = confirming.has(m.profileId);
                return (
                  <Pressable
                    key={m.profileId}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    onPress={() => {
                      const next = new Set(confirming);
                      if (on) next.delete(m.profileId);
                      else next.add(m.profileId);
                      setConfirming(next);
                    }}
                    style={[styles.check, { borderColor: on ? c.accent : c.border }]}
                  >
                    <Text style={{ color: on ? c.accent : c.muted, fontWeight: "700", width: 22 }}>{on ? "X" : ""}</Text>
                    <Text style={{ color: c.text, fontSize: 16 }}>{m.fullName}</Text>
                  </Pressable>
                );
              })}
              <Button
                title={`Confirm ${confirming.size} ${confirming.size === 1 ? "man" : "men"}`}
                onPress={() =>
                  act(async () => {
                    const today = new Date();
                    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                    const err = await confirmServed(claim.id, [...confirming], day);
                    if (!err) setConfirming(null);
                    return err;
                  })
                }
              />
            </>
          )}
        </Card>
      ) : null}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  check: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 48 },
});
