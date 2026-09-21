import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useGroup, type RosterMan } from "@/lib/group";
import { timeAgo } from "@/lib/pray";
import { supabase } from "@/lib/supabase";

type Method = "call" | "text" | "in_person";
const METHOD_LABEL: Record<Method, string> = { call: "call", text: "text", in_person: "visit" };

// Leaders: tap to call or text, then log it in one tap when they come back. No notes
// field: what was said stays between the two men (scoring plan). Members see names
// and a Call button only.
export default function Roster() {
  const { state } = useGroup();
  const { state: auth } = useAuth();
  const c = useColors();
  const group = state.status === "ready" ? state.group : null;
  const me = auth.status === "ready" ? auth.session.user.id : null;
  const ministryId = auth.status === "ready" ? auth.membership.ministryId : null;
  const [lastContact, setLastContact] = useState<Map<string, Date>>(new Map());
  const pending = useRef<{ man: RosterMan; method: Method } | null>(null);

  const loadContacts = useCallback(async () => {
    if (!group?.iLead) return;
    // RLS returns only contacts with men in groups he leads.
    const { data } = await supabase
      .from("contact_logs")
      .select("profile_id, contacted_at")
      .in("profile_id", group.roster.map((m) => m.profileId))
      .order("contacted_at", { ascending: false });
    const latest = new Map<string, Date>();
    for (const row of data ?? []) if (!latest.has(row.profile_id)) latest.set(row.profile_id, new Date(row.contacted_at));
    setLastContact(latest);
  }, [group]);

  useFocusEffect(useCallback(() => void loadContacts(), [loadContacts]));

  const log = useCallback(
    async (man: RosterMan, method: Method) => {
      if (!me || !ministryId) return;
      const { error } = await supabase
        .from("contact_logs")
        .insert({ ministry_id: ministryId, profile_id: man.profileId, leader_id: me, method });
      if (error) Alert.alert("Not logged", error.message);
      else void loadContacts();
    },
    [me, ministryId, loadContacts],
  );

  // After a call or text, returning to the app offers to log it.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active" || !pending.current) return;
      const { man, method } = pending.current;
      pending.current = null;
      Alert.alert(`Log your ${METHOD_LABEL[method]} with ${man.fullName.split(" ")[0]}?`, undefined, [
        { text: "Not now", style: "cancel" },
        { text: "Log it", onPress: () => void log(man, method) },
      ]);
    });
    return () => sub.remove();
  }, [log]);

  if (!group) return null;

  const reach = (man: RosterMan, method: "call" | "text") => {
    if (!man.phone) return;
    if (group.iLead && man.profileId !== me) pending.current = { man, method };
    void Linking.openURL(`${method === "call" ? "tel" : "sms"}:${man.phone}`);
  };

  return (
    <Screen>
      <Card title={`${group.roster.length} men`}>
        {group.roster.map((man) => {
          const last = lastContact.get(man.profileId);
          const isMe = man.profileId === me;
          return (
            <View key={man.profileId} style={[styles.man, { borderBottomColor: c.border }]}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={{ color: c.text, fontSize: 16 }}>{man.fullName}{isMe ? " (you)" : ""}</Text>
                  {man.leads ? <Text style={{ color: c.accent, fontSize: 13 }}>Leader</Text> : null}
                  {group.iLead && !isMe ? (
                    <Text style={{ color: last ? c.muted : c.accent, fontSize: 13 }}>
                      {last ? `Last contact ${timeAgo(last)}` : "No contact logged yet"}
                    </Text>
                  ) : null}
                </View>
              </View>
              {!isMe ? (
                <View style={styles.actions}>
                  {man.phone ? <Action label="Call" onPress={() => reach(man, "call")} /> : null}
                  {man.phone && group.iLead ? <Action label="Text" onPress={() => reach(man, "text")} /> : null}
                  {group.iLead ? (
                    <Action
                      label="Saw him"
                      onPress={() =>
                        Alert.alert(`Log a visit with ${man.fullName.split(" ")[0]}?`, undefined, [
                          { text: "Cancel", style: "cancel" },
                          { text: "Log it", onPress: () => void log(man, "in_person") },
                        ])
                      }
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.action, { borderColor: c.accent }]}>
      <Text style={{ color: c.accent, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  man: { paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  action: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: "center" },
});
