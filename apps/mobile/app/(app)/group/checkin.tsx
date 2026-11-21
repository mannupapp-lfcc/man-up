import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, ErrorText, Field, Loading, Screen, Title, useColors } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { SCALE_LABEL, thisWeekOf, useGroupCheckins } from "@/lib/checkins";
import { useGroup } from "@/lib/group";
import { TIER_COLOR } from "@/lib/scores";
import { supabase } from "@/lib/supabase";

// Weekly check-in: how he is really doing, 1 to 5, plus an optional note. His group
// sees it; nobody outside the group does, and the number never affects his standing.
export default function WeeklyCheckin() {
  const c = useColors();
  const { saved } = useLocalSearchParams<{ saved?: string }>();
  const { state } = useGroup();
  const { state: auth } = useAuth();
  const group = state.status === "ready" ? state.group : null;
  const me = auth.status === "ready" ? auth.session.user.id : null;
  const ministryId = auth.status === "ready" ? auth.membership.ministryId : null;
  const { rows, reload } = useGroupCheckins(group?.groupId ?? null, 1);
  const week = thisWeekOf();
  const mine = rows?.find((r) => r.profileId === me && r.weekOf === week);

  if (!group || !rows || !ministryId) return <Loading />;

  const thisWeek = rows.filter((r) => r.weekOf === week && r.profileId !== me);

  return (
    <Screen>
      <Title>How are you really doing?</Title>
      <Body muted>Only the men in {group.name} see your answer. Honest is better than fine.</Body>

      {/* Rendered once the week has loaded, so it starts from his saved answer. */}
      <CheckinForm ministryId={ministryId} initialScale={mine?.scale ?? (saved ? Number(saved) : null)}
        initialNote={mine?.note ?? ""} savedFromPush={!!saved} isUpdate={!!mine} onSaved={() => void reload()} />

      <Card title="Your group this week">
        {thisWeek.length === 0 ? <Body muted>No one else has checked in yet this week.</Body> : null}
        {thisWeek.map((r) => (
          <View key={r.id} style={[styles.row, { borderColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: "700" }}>
              {r.fullName} <Text style={{ color: c.accent }}>{r.scale}</Text>
              <Text style={{ color: c.muted, fontWeight: "400" }}> {SCALE_LABEL[r.scale]}</Text>
            </Text>
            {r.note ? <Text style={{ color: c.text, fontSize: 15, lineHeight: 22 }}>{r.note}</Text> : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

// Once he has answered this week, he sees his saved answer (read only) with an Edit
// button. Editing opens the form; Cancel puts back what was saved.
function CheckinForm({ ministryId, initialScale, initialNote, savedFromPush, isUpdate, onSaved }: {
  ministryId: string; initialScale: number | null; initialNote: string; savedFromPush: boolean; isUpdate: boolean; onSaved: () => void;
}) {
  const c = useColors();
  const [saved, setSaved] = useState<{ scale: number; note: string } | null>(
    (isUpdate || savedFromPush) && initialScale ? { scale: initialScale, note: initialNote } : null,
  );
  const [editing, setEditing] = useState(!saved);
  const [scale, setScale] = useState<number | null>(initialScale);
  const [note, setNote] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!scale) return setError("Pick a number first.");
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.rpc("submit_checkin", { p_ministry: ministryId, p_scale: scale, p_note: note.trim() || undefined });
    setBusy(false);
    if (e) return setError(e.message);
    setSaved({ scale, note: note.trim() });
    setNote(note.trim());
    setEditing(false);
    onSaved();
  };

  const cancel = () => {
    if (!saved) return;
    setScale(saved.scale);
    setNote(saved.note);
    setError(null);
    setEditing(false);
  };

  if (saved && !editing) {
    return (
      <Card>
        <View style={styles.savedHead}>
          <Ionicons name="checkmark-circle" size={22} color={TIER_COLOR.Thriving} />
          <Text style={{ color: TIER_COLOR.Thriving, fontSize: 15, fontWeight: "700" }}>Checked in this week</Text>
        </View>
        <View style={styles.savedAnswer}>
          <View style={[styles.savedBadge, { backgroundColor: c.accent }]}>
            <Text style={{ color: c.onAccent, fontSize: 26, fontWeight: "800" }}>{saved.scale}</Text>
          </View>
          <Text style={{ color: c.text, fontSize: 20, fontWeight: "700" }}>{SCALE_LABEL[saved.scale]}</Text>
        </View>
        {saved.note ? (
          <Text style={{ color: c.text, fontSize: 16, lineHeight: 24 }}>{saved.note}</Text>
        ) : (
          <Body muted>No note this week.</Body>
        )}
        <Body muted>Your group sees this. Thanks for being honest.</Body>
        <Button title="Edit my check-in" variant="secondary" onPress={() => setEditing(true)} />
      </Card>
    );
  }

  return (
    <Card>
      <View style={styles.scale}>
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = scale === n;
          return (
            <Pressable key={n} accessibilityRole="button" accessibilityLabel={`${n}, ${SCALE_LABEL[n]}`} accessibilityState={{ selected }}
              onPress={() => setScale(n)}
              style={[styles.option, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accent : c.bg }]}>
              <Text style={{ color: selected ? c.onAccent : c.text, fontSize: 22, fontWeight: "800" }}>{n}</Text>
              <Text style={{ color: selected ? c.onAccent : c.muted, fontSize: 11 }}>{SCALE_LABEL[n]}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field label="Anything you want your brothers to know? (optional)" value={note} onChangeText={setNote}
        multiline maxLength={500} style={{ minHeight: 90, textAlignVertical: "top" }} />
      <ErrorText>{error}</ErrorText>
      <Button title={saved ? "Save changes" : "Check in"} onPress={() => void save()} busy={busy} />
      {saved ? <Button title="Cancel" variant="secondary" onPress={cancel} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  scale: { flexDirection: "row", gap: 8 },
  option: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center", gap: 2 },
  savedHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  savedAnswer: { flexDirection: "row", alignItems: "center", gap: 14 },
  savedBadge: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  row: { gap: 4, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
});
