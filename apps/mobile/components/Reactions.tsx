import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, useColors } from "@/components/ui";
import { REACTIONS, type Reaction, type ReactionKind } from "@/lib/reactions";

// The reactions under a message: one chip per kind with its count, gold-outlined when
// he gave it. Tap to add or take back; long press to see who reacted.
export function ReactionRow({ reactions, me, names, onToggle, alignEnd }: {
  reactions: Reaction[] | undefined;
  me: string;
  names: (profileId: string) => string | undefined;
  onToggle?: (kind: ReactionKind) => void; // omitted: read only (overseers)
  alignEnd?: boolean;
}) {
  const c = useColors();
  if (!reactions?.length) return null;
  const groups = REACTIONS.map((r) => ({ ...r, rows: reactions.filter((x) => x.reaction === r.kind) })).filter((g) => g.rows.length);

  return (
    <View style={[styles.row, alignEnd && { justifyContent: "flex-end" }]}>
      {groups.map((g) => {
        const mine = g.rows.some((r) => r.profile_id === me);
        const who = g.rows.map((r) => (r.profile_id === me ? "You" : names(r.profile_id) ?? "Former member"));
        return (
          <Pressable
            key={g.kind}
            disabled={!onToggle}
            onPress={() => onToggle?.(g.kind)}
            onLongPress={() => Alert.alert(`${g.emoji} ${g.label}`, who.join("\n"))}
            accessibilityRole="button"
            accessibilityState={{ selected: mine }}
            accessibilityLabel={`${g.label}, ${g.rows.length}${mine ? ", including you" : ""}`}
            accessibilityHint={onToggle ? (mine ? "Tap to take back. Long press to see who." : "Tap to add yours. Long press to see who.") : "Long press to see who."}
            style={[styles.chip, { backgroundColor: c.field, borderColor: mine ? c.accent : c.border }]}
          >
            <Text style={styles.emoji}>{g.emoji}</Text>
            <Text style={{ color: mine ? c.accent : c.muted, fontSize: 13, fontWeight: "700" }}>{g.rows.length}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Long-press sheet on a message: a row of reactions on top, then the message actions
// (delete his own, or report / block another man's).
export function MessageMenu({ visible, mine, myKinds, onReact, onDelete, onReport, onClose }: {
  visible: boolean;
  mine: boolean;
  myKinds: Set<ReactionKind>;
  onReact: (kind: ReactionKind) => void;
  onDelete: () => void;
  onReport: () => void;
  onClose: () => void;
}) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: c.field, borderColor: c.border }]}>
        <View style={styles.picker}>
          {REACTIONS.map((r) => {
            const given = myKinds.has(r.kind);
            return (
              <Pressable
                key={r.kind}
                accessibilityRole="button"
                accessibilityLabel={given ? `Take back ${r.label}` : `React with ${r.label}`}
                accessibilityState={{ selected: given }}
                onPress={() => { onClose(); onReact(r.kind); }}
                style={({ pressed }) => [styles.pick, { borderColor: given ? c.accent : "transparent" }, pressed && { backgroundColor: c.navy }]}
              >
                <Text style={styles.pickEmoji}>{r.emoji}</Text>
              </Pressable>
            );
          })}
        </View>
        {mine ? (
          <Button title="Delete message" variant="secondary" onPress={() => { onClose(); onDelete(); }} />
        ) : (
          <Button title="Report or block" variant="secondary" onPress={() => { onClose(); onReport(); }} />
        )}
        <Button title="Cancel" variant="secondary" onPress={onClose} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 14, paddingHorizontal: 8, minHeight: 28 },
  emoji: { fontSize: 14 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, padding: 20, gap: 14 },
  picker: { flexDirection: "row", justifyContent: "space-between", paddingBottom: 4 },
  pick: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pickEmoji: { fontSize: 30 },
});
