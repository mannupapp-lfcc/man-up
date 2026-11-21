import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { useContactLogger } from "@/lib/contact";
import { useGroup, type RosterMan } from "@/lib/group";
import { timeAgo } from "@/lib/pray";
import { supabase } from "@/lib/supabase";

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

  const { reach: dial, logVisit } = useContactLogger({ me, ministryId, onLogged: loadContacts });

  if (!group) return null;

  const reach = (man: RosterMan, method: "call" | "text") => dial(man, method, group.iLead && man.profileId !== me);

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
                      onPress={() => logVisit(man)}
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
