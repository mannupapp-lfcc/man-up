import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { DbEnum } from "@manup/shared";
import { Body, Card, Chip, Field, Loading, Screen, Title, useColors } from "@/components/ui";
import { GroupForm, type GroupValues } from "@/components/GroupForm";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

const ROLE_LABEL: Record<DbEnum<"ministry_role">, string> = { member: "Member", co_leader: "Co-leader", leader: "Leader", admin: "Admin" };

type Man = { profileId: string; fullName: string; role: DbEnum<"ministry_role">; leads: boolean; current: string | null };

// One group for ministry admins: its men, who leads it, and its schedule.
// Same rules as the admin website's group page (place_member, set_group_leader).
export default function AdminGroup() {
  const c = useColors();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { state } = useAuth();
  const ministryId = state.status === "ready" ? state.membership.ministryId : null;
  const [data, setData] = useState<{ group: GroupValues & { id: string }; roster: Man[]; others: Man[] } | null | "missing">(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ministryId) return;
    const [group, people, placements] = await Promise.all([
      supabase.from("groups").select("id, name, status, meeting_day, meeting_time").eq("id", groupId).eq("ministry_id", ministryId).maybeSingle(),
      supabase.from("ministry_members").select("profile_id, role, profiles(full_name)").eq("ministry_id", ministryId).is("left_at", null),
      supabase.from("group_members").select("group_id, profile_id, is_group_leader, groups(name)").eq("ministry_id", ministryId).is("left_at", null),
    ]);
    if (!group.data) return setData("missing");
    const byProfile = new Map((placements.data ?? []).map((p) => [p.profile_id, p]));
    const men: Man[] = (people.data ?? []).map((p) => {
      const placed = byProfile.get(p.profile_id);
      return {
        profileId: p.profile_id, fullName: p.profiles?.full_name ?? "", role: p.role,
        leads: placed?.group_id === groupId && placed.is_group_leader,
        current: placed && placed.group_id !== groupId ? placed.groups?.name ?? "another group" : null,
      };
    });
    const inGroup = new Set((placements.data ?? []).filter((p) => p.group_id === groupId).map((p) => p.profile_id));
    const byName = (a: Man, b: Man) => a.fullName.localeCompare(b.fullName);
    setData({
      group: group.data,
      roster: men.filter((m) => inGroup.has(m.profileId)).sort((a, b) => Number(b.leads) - Number(a.leads) || byName(a, b)),
      others: men.filter((m) => !inGroup.has(m.profileId)).sort((a, b) => Number(!!a.current) - Number(!!b.current) || byName(a, b)),
    });
  }, [groupId, ministryId]);
  useFocusEffect(useCallback(() => void load(), [load]));

  // Every change goes through the same RLS as the website; reload after each one.
  const run = async (action: () => PromiseLike<{ error: { message: string } | null }>) => {
    if (busy) return;
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) Alert.alert("Not saved", error.message);
    void load();
  };

  if (data === null || !ministryId) return <Loading />;
  if (data === "missing") return <Screen><Body>This group is not available.</Body></Screen>;
  const { group, roster, others } = data;
  const first = (m: Man) => m.fullName.split(" ")[0];

  const add = (m: Man) => {
    const place = () => void run(() => supabase.rpc("place_member", { p_group: group.id, p_profile: m.profileId }));
    if (!m.current) return place();
    Alert.alert(`Move ${first(m)}?`, `He will leave ${m.current} and join ${group.name}.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Move him", onPress: place },
    ]);
  };
  const makeLeader = (m: Man, role: "leader" | "co_leader") =>
    void run(() => supabase.rpc("set_group_leader", { p_group: group.id, p_profile: m.profileId, p_role: role }));
  // Stops leading this group. His ministry role is left alone (change it on the website's People page).
  const stopLeading = (m: Man) =>
    void run(() => supabase.from("group_members").update({ is_group_leader: false })
      .eq("ministry_id", ministryId).eq("group_id", group.id).eq("profile_id", m.profileId).is("left_at", null));
  const remove = (m: Man) =>
    Alert.alert(`Remove ${first(m)} from ${group.name}?`, "He stays in the ministry and shows up under Not in a group.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: () => void run(() => supabase.from("group_members").update({ left_at: new Date().toISOString(), is_group_leader: false })
          .eq("ministry_id", ministryId).eq("group_id", group.id).eq("profile_id", m.profileId).is("left_at", null)),
      },
    ]);

  const q = search.trim().toLowerCase();
  const matches = others.filter((m) => !q || m.fullName.toLowerCase().includes(q));

  return (
    <Screen>
      <Title>{group.name}</Title>

      <Card title={`Men in this group (${roster.length})`}>
        {roster.length === 0 ? <Body muted>No one yet. Add men below.</Body> : null}
        {roster.map((m) => (
          <View key={m.profileId} style={[styles.man, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>{m.fullName}</Text>
            <Text style={{ color: m.leads ? c.accent : c.muted, fontSize: 13 }}>{ROLE_LABEL[m.role]}{m.leads ? ", leads this group" : ""}</Text>
            <View style={styles.chips}>
              {m.leads ? <Chip label="Stop leading" onPress={() => stopLeading(m)} /> : (
                <>
                  <Chip label="Make leader" onPress={() => makeLeader(m, "leader")} />
                  <Chip label="Make co-leader" onPress={() => makeLeader(m, "co_leader")} />
                </>
              )}
              <Chip label="Remove" onPress={() => remove(m)} />
            </View>
          </View>
        ))}
      </Card>

      <Card title="Add a man">
        <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name" autoCorrect={false} />
        {matches.length === 0 ? <Body muted>{q ? "No one by that name." : "Everyone in the ministry is already in this group."}</Body> : null}
        {matches.slice(0, 30).map((m) => (
          <View key={m.profileId} style={styles.row}>
            <View style={styles.flex}>
              <Text style={{ color: c.text, fontSize: 16 }}>{m.fullName}</Text>
              <Text style={{ color: c.muted, fontSize: 13 }}>{m.current ? `In ${m.current}` : "Not in a group"}</Text>
            </View>
            <Chip label={m.current ? "Move here" : "Add"} onPress={() => add(m)} />
          </View>
        ))}
        {matches.length > 30 ? <Body muted>Search to see more.</Body> : null}
      </Card>

      <Card title="Group details">
        <GroupForm
          initial={group}
          submitLabel="Save group"
          onSubmit={async (values) => {
            const { error } = await supabase.from("groups").update(values).eq("id", group.id).eq("ministry_id", ministryId);
            if (error) return error.message;
            // Moves future meetings to the new schedule (never ones with attendance).
            const gen = await supabase.rpc("generate_meetings", { p_ministry: ministryId });
            if (gen.error) return gen.error.message;
            Alert.alert("Group saved");
            void load();
            return null;
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  man: { gap: 4, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  flex: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 6 },
});
