import { useCallback, useEffect, useRef } from "react";
import { Alert, AppState, Linking } from "react-native";
import type { RosterMan } from "./group";
import { supabase } from "./supabase";

export type ContactMethod = "call" | "text" | "in_person";
const METHOD_LABEL: Record<ContactMethod, string> = { call: "call", text: "text", in_person: "visit" };

// A Needs a Call flag starts when the Sunday night score that raised it was written
// (same anchor as the scoring job's follow-through window). A contact logged after
// that counts as following up on this flag.
export function flaggedSince(asOf: string) {
  return new Date(`${asOf}T23:00:00Z`);
}

// Leaders call or text from the app, and when they come back they get a prompt to log it
// with one tap. No notes field: what was said stays between the two men.
export function useContactLogger(opts: { me: string | null; ministryId: string | null; onLogged: () => void }) {
  const { me, ministryId, onLogged } = opts;
  const pending = useRef<{ man: RosterMan; method: ContactMethod } | null>(null);

  const log = useCallback(
    async (man: RosterMan, method: ContactMethod) => {
      if (!me || !ministryId) return;
      const { error } = await supabase
        .from("contact_logs")
        .insert({ ministry_id: ministryId, profile_id: man.profileId, leader_id: me, method });
      if (error) Alert.alert("Not logged", error.message);
      else onLogged();
    },
    [me, ministryId, onLogged],
  );

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

  // Opens the dialer or messages. trackForLog=false for a member calling a brother.
  const reach = useCallback((man: RosterMan, method: "call" | "text", trackForLog = true) => {
    if (!man.phone) return;
    if (trackForLog) pending.current = { man, method };
    void Linking.openURL(`${method === "call" ? "tel" : "sms"}:${man.phone}`);
  }, []);

  const logVisit = useCallback(
    (man: RosterMan) =>
      Alert.alert(`Log a visit with ${man.fullName.split(" ")[0]}?`, undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Log it", onPress: () => void log(man, "in_person") },
      ]),
    [log],
  );

  return { reach, logVisit };
}
