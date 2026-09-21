import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Screen, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type Blocked = { id: string; blocked_id: string; name: string | null };

export default function BlockedMen() {
  const c = useColors();
  const { state: auth } = useAuth();
  const [rows, setRows] = useState<Blocked[] | null>(null);
  const me = auth.status === "ready" ? auth.session.user.id : null;

  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase.from("user_blocks").select("id, blocked_id").eq("blocker_id", me);
    const ids = (data ?? []).map((b) => b.blocked_id);
    // Names are visible only for men he can otherwise see (e.g. his group).
    const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
    const names = new Map((people ?? []).map((p) => [p.id, p.full_name]));
    setRows((data ?? []).map((b) => ({ ...b, name: names.get(b.blocked_id) ?? null })));
  }, [me]);

  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <Screen>
      <Body muted>You don't see messages or prayer requests from men you block. They are not told.</Body>
      <Card>
        {rows?.length === 0 ? <Body muted>You haven't blocked anyone.</Body> : null}
        {rows?.map((b) => (
          <View key={b.id} style={styles.row}>
            <Text style={{ color: c.text, fontSize: 16, flex: 1 }}>{b.name ?? "A man you blocked"}</Text>
            <View style={styles.button}>
              <Button title="Unblock" variant="secondary" onPress={async () => { await supabase.from("user_blocks").delete().eq("id", b.id); void load(); }} />
            </View>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  button: { minWidth: 110 },
});
