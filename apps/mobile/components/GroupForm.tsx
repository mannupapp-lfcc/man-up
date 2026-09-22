import type { DbEnum } from "@manup/shared";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Chip, ErrorText, Field, useColors } from "./ui";

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type GroupValues = {
  name: string;
  meeting_day: string | null;
  meeting_time: string | null; // "HH:MM" (24-hour), as the database stores it
  status: DbEnum<"group_status">;
};

// "7", "7pm", "7:30 PM", "19:00" -> "19:00". Empty -> null. Unreadable -> undefined.
export function parseTime(text: string): string | null | undefined {
  const t = text.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  const m = /^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)?$/.exec(t);
  if (!m) return undefined;
  let hour = Number(m[1]);
  const minute = Number(m[2] ?? 0);
  const suffix = m[3]?.[0];
  if (minute > 59) return undefined;
  if (suffix) {
    if (hour < 1 || hour > 12) return undefined;
    hour = (hour % 12) + (suffix === "p" ? 12 : 0);
  } else if (hour > 23) return undefined;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

// "19:00:00" -> "7:00 PM"
export function formatTime(value: string | null) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  return `${((h! + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h! >= 12 ? "PM" : "AM"}`;
}

const STATUS_LABEL: Record<DbEnum<"group_status">, string> = { forming: "Forming", active: "Active", archived: "Archived" };

// Same fields as the admin website's group form. Archiving is offered only when editing.
export function GroupForm({ initial, submitLabel, onSubmit }: {
  initial?: GroupValues;
  submitLabel: string;
  onSubmit: (values: GroupValues) => Promise<string | null>; // returns an error message or null
}) {
  const c = useColors();
  const [name, setName] = useState(initial?.name ?? "");
  const [day, setDay] = useState<string | null>(initial?.meeting_day ?? null);
  const [time, setTime] = useState(formatTime(initial?.meeting_time ?? null));
  const [status, setStatus] = useState<DbEnum<"group_status">>(initial?.status ?? "forming");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const statuses: DbEnum<"group_status">[] = initial ? ["forming", "active", "archived"] : ["forming", "active"];

  const submit = async () => {
    const meetingTime = parseTime(time);
    if (!name.trim()) return setError("Give the group a name.");
    if (meetingTime === undefined) return setError("Enter the time like 7:00 PM.");
    setError(null);
    setBusy(true);
    const message = await onSubmit({ name: name.trim(), meeting_day: day, meeting_time: meetingTime, status });
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <View style={styles.form}>
      <Field label="Name" value={name} onChangeText={setName} autoCapitalize="words" />
      <View style={styles.block}>
        <Text style={[styles.label, { color: c.text }]}>Meets on</Text>
        <View style={styles.chips}>
          {DAYS.map((d) => <Chip key={d} label={d.slice(0, 3)} selected={day === d} onPress={() => setDay(day === d ? null : d)} />)}
        </View>
      </View>
      <Field label="At" value={time} onChangeText={setTime} placeholder="7:00 PM" autoCapitalize="none" autoCorrect={false} hint="Local time. Leave blank if not set yet." />
      <View style={styles.block}>
        <Text style={[styles.label, { color: c.text }]}>Status</Text>
        <View style={styles.chips}>
          {statuses.map((s) => <Chip key={s} label={STATUS_LABEL[s]} selected={status === s} onPress={() => setStatus(s)} />)}
        </View>
        <Text style={{ color: c.muted, fontSize: 13 }}>Active groups get meetings scheduled on their day and time.</Text>
      </View>
      <ErrorText>{error}</ErrorText>
      <Button title={submitLabel} onPress={() => void submit()} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  block: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
