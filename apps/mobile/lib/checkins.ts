import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { supabase } from "./supabase";

// Weekly check-in (0014): 1 to 5 plus an optional note, visible to his group only.
// Scoring counts that he checked in; the number and the note never leave the group.

export const SCALE_LABEL: Record<number, string> = { 1: "Rough", 2: "Hard", 3: "Okay", 4: "Good", 5: "Strong" };

export type Checkin = { id: string; profileId: string; fullName: string; weekOf: string; scale: number; note: string | null };

// Monday of this week on the phone's calendar, as YYYY-MM-DD (the server uses the
// ministry's time zone; the two differ only for a man traveling across zones).
export function thisWeekOf(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The group's check-ins for the last `weeks` weeks, newest week first. RLS returns
// only his current group's rows (and hides men he blocked).
export function useGroupCheckins(groupId: string | null, weeks = 8) {
  const [rows, setRows] = useState<Checkin[] | null>(null);
  const load = useCallback(async () => {
    if (!groupId) return;
    const monday = new Date(`${thisWeekOf()}T12:00:00`);
    const since = new Date(monday.getTime() - (weeks - 1) * 7 * 86_400_000);
    const { data } = await supabase
      .from("weekly_checkins")
      .select("id, profile_id, week_of, scale, note, profiles(full_name)")
      .eq("group_id", groupId)
      .gte("week_of", thisWeekOf(since))
      .order("week_of", { ascending: false });
    setRows((data ?? []).map((r) => ({
      id: r.id, profileId: r.profile_id, fullName: r.profiles?.full_name ?? "A brother",
      weekOf: r.week_of, scale: r.scale, note: r.note,
    })));
  }, [groupId, weeks]);
  useFocusEffect(useCallback(() => void load(), [load]));
  return { rows, reload: load };
}

// Group pulse for leaders: per week, how many answered and the average. Trend only.
export function pulseByWeek(rows: Checkin[]) {
  const byWeek = new Map<string, number[]>();
  for (const r of rows) byWeek.set(r.weekOf, [...(byWeek.get(r.weekOf) ?? []), r.scale]);
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekOf, scales]) => ({ weekOf, answered: scales.length, average: scales.reduce((s, x) => s + x, 0) / scales.length }));
}
