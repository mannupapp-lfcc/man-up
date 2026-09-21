import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { JoinChoice } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Body, Field, useColors } from "./ui";

type OpenMinistry = { ministry_id: string; ministry_name: string; organization_name: string };

// Lets a man join an open ministry as a member, or enter an invite code instead.
// With one open ministry (Man Up today) there is nothing to pick.
export function useJoinChoice() {
  const c = useColors();
  const [ministries, setMinistries] = useState<OpenMinistry[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [useCode, setUseCode] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    void supabase.rpc("list_open_ministries").then(({ data }) => {
      const list = data ?? [];
      setMinistries(list);
      if (list.length === 1 && list[0]) setSelected(list[0].ministry_id);
      if (list.length === 0) setUseCode(true);
    });
  }, []);

  // Validates the choice before any account or membership is created.
  async function resolve(): Promise<{ choice: JoinChoice } | { error: string }> {
    if (useCode) {
      const trimmed = code.trim();
      if (!trimmed) return { error: "Enter your invite code." };
      const { data, error } = await supabase.rpc("check_invite", { p_code: trimmed });
      if (error) return { error: "Could not check that code. Try again." };
      if (!data?.length) return { error: "That invite code is not valid. Check it with the person who gave it to you." };
      return { choice: { code: trimmed } };
    }
    if (!selected) return { error: "Choose a ministry to join." };
    return { choice: { ministryId: selected } };
  }

  const only = ministries?.length === 1 ? ministries[0] : undefined;

  const element = (
    <View style={styles.wrap}>
      {!useCode && only ? (
        <Body muted>
          You will join {only.ministry_name} at {only.organization_name}.
        </Body>
      ) : null}

      {!useCode && ministries && ministries.length > 1 ? (
        <View style={styles.wrap}>
          <Text style={[styles.label, { color: c.text }]}>Ministry</Text>
          {ministries.map((m) => {
            const on = m.ministry_id === selected;
            return (
              <Pressable
                key={m.ministry_id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => setSelected(m.ministry_id)}
                style={[styles.option, { borderColor: on ? c.accent : c.border }]}
              >
                <Text style={{ color: c.text, fontSize: 16 }}>{m.ministry_name}</Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>{m.organization_name}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {useCode ? (
        <Field
          label="Invite code"
          hint={ministries?.length === 0 ? "Signups are by invite code right now." : "Leaders get a code from a ministry admin."}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      ) : null}

      {ministries && ministries.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => setUseCode((v) => !v)}>
          <Text style={{ color: c.accent, fontSize: 15 }}>
            {useCode ? "I don't have a code" : "I have an invite code"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  return { element, resolve, ready: ministries !== null };
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  label: { fontSize: 15, fontWeight: "600" },
  option: { borderWidth: 2, borderRadius: 10, padding: 12, gap: 2 },
});
