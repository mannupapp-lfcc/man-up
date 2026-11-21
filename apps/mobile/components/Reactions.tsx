import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/components/ui";
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

// Long-press sheet on a message. Slides up over a dimmed screen and shows the message
// he picked, a pill of reactions, then the message actions (delete his own, or
// report / block another man's). Built on React Native's Animated only, so it ships
// as an OTA update with no new native code.
export function MessageMenu({ visible, mine, author, preview, myKinds, onReact, onDelete, onReport, onClose }: {
  visible: boolean;
  mine: boolean;
  author?: string;
  preview?: string;
  myKinds: Set<ReactionKind>;
  onReact: (kind: ReactionKind) => void;
  onDelete: () => void;
  onReport: () => void;
  onClose: () => void;
}) {
  const c = useColors();
  // Stays mounted while the exit animation runs after the parent hides it.
  const [mounted, setMounted] = useState(visible);
  const [picked, setPicked] = useState<ReactionKind | null>(null);
  const [progress] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  const closing = useRef(false);
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!visible) return;
    closing.current = false;
    progress.setValue(0);
    Animated.spring(progress, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 220, mass: 0.8 }).start();
  }, [visible, progress]);

  // Animate out, then tell the parent (and run the chosen action, if any).
  function dismiss(then?: () => void) {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, { toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setMounted(false);
      setPicked(null);
      onClose();
      then?.();
    });
  }

  function react(kind: ReactionKind) {
    if (closing.current) return;
    setPicked(kind);
    pop.setValue(1);
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.45, duration: 110, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 12 }),
    ]).start();
    setTimeout(() => dismiss(() => onReact(kind)), 180);
  }

  if (!mounted) return null;
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [420, 0] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => dismiss()} statusBarTranslucent navigationBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => dismiss()} accessibilityLabel="Close" />
      </Animated.View>
      <View style={styles.bottom} pointerEvents="box-none">
        <Animated.View style={{ transform: [{ translateY }] }}>
          <SafeAreaView edges={["bottom"]} style={[styles.sheet, { backgroundColor: c.field, borderColor: c.border }]}>
            <View style={[styles.grabber, { backgroundColor: c.border }]} />

            {preview ? (
              <View style={[styles.preview, { backgroundColor: mine ? c.navy : c.bg, borderColor: c.border }]}>
                <Text style={{ color: c.accent, fontWeight: "700", fontSize: 13 }}>{mine ? "You" : author ?? "Former member"}</Text>
                <Text numberOfLines={3} style={{ color: c.text, fontSize: 15, lineHeight: 20 }}>{preview}</Text>
              </View>
            ) : null}

            <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }]}>
              {REACTIONS.map((r) => {
                const given = myKinds.has(r.kind);
                const scale = picked === r.kind ? pop : 1;
                return (
                  <Pressable
                    key={r.kind}
                    accessibilityRole="button"
                    accessibilityLabel={given ? `Take back ${r.label}` : `React with ${r.label}`}
                    accessibilityState={{ selected: given }}
                    onPress={() => react(r.kind)}
                    hitSlop={4}
                    style={({ pressed }) => [
                      styles.pick,
                      given && { backgroundColor: c.navy, borderColor: c.accent },
                      pressed && { transform: [{ scale: 1.2 }] },
                    ]}
                  >
                    <Animated.Text style={[styles.pickEmoji, { transform: [{ scale }] }]}>{r.emoji}</Animated.Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={[styles.actions, { borderColor: c.border }]}>
              {mine ? (
                <MenuRow icon="trash-outline" label="Delete message" color={c.error} onPress={() => dismiss(onDelete)} />
              ) : (
                <MenuRow icon="flag-outline" label="Report or block" color={c.text} onPress={() => dismiss(onReport)} />
              )}
            </View>

            <Pressable accessibilityRole="button" onPress={() => dismiss()} style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}>
              <Text style={{ color: c.muted, fontSize: 16, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuRow({ icon, label, color, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: c.navy }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ color, fontSize: 16, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: -2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 14, paddingHorizontal: 9, minHeight: 28 },
  emoji: { fontSize: 15 },
  backdrop: { backgroundColor: "rgba(0,0,0,0.65)" },
  bottom: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 14 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, marginBottom: 2 },
  preview: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  pill: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderRadius: 32, paddingHorizontal: 8, paddingVertical: 6 },
  pick: { width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  pickEmoji: { fontSize: 30 },
  actions: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, minHeight: 52 },
  cancel: { alignItems: "center", justifyContent: "center", minHeight: 48 },
});
