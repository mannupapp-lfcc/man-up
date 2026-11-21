import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import type { AttendanceStatus, Meeting, RosterMan } from "./group";
import { supabase } from "./supabase";

// Overseers (0020): a ministry admin flagged is_overseer reads any group in the
// ministry, read only. The database enforces it (fn_oversees); these screens only
// show what RLS returns. Reflections and anonymous authors stay hidden.

export type OverseenGroup = {
  groupId: string;
  name: string;
  roster: RosterMan[];
  past: Meeting[];
  // Latest logged contact per man (group_contact_logs; never the note).
  lastContact: Map<string, Date>;
};

type State = { status: "loading" } | { status: "missing" } | { status: "ready"; group: OverseenGroup };

export function useOverseenGroup(groupId: string) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    const [group, roster, meetings, contacts] = await Promise.all([
      supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle(),
      supabase
        .from("group_members")
        .select("profile_id, is_group_leader, profiles(full_name, phone)")
        .eq("group_id", groupId)
        .is("left_at", null),
      supabase
        .from("meetings")
        .select("id, meeting_at, attendance_marked_at")
        .eq("group_id", groupId)
        .lte("meeting_at", new Date().toISOString())
        .order("meeting_at", { ascending: false })
        .limit(8),
      supabase.rpc("group_contact_logs", { p_group: groupId }),
    ]);
    if (!group.data || roster.error || meetings.error) return setState({ status: "missing" });

    const attendance = await supabase
      .from("meeting_attendance")
      .select("meeting_id, profile_id, status")
      .in("meeting_id", meetings.data.map((m) => m.id));
    const byMeeting = new Map<string, Record<string, AttendanceStatus>>();
    for (const a of attendance.data ?? []) {
      const row = byMeeting.get(a.meeting_id) ?? {};
      row[a.profile_id] = a.status;
      byMeeting.set(a.meeting_id, row);
    }

    const lastContact = new Map<string, Date>();
    for (const c of contacts.data ?? []) if (!lastContact.has(c.profile_id)) lastContact.set(c.profile_id, new Date(c.contacted_at));

    setState({
      status: "ready",
      group: {
        groupId,
        name: group.data.name,
        roster: roster.data
          .map((r) => ({ profileId: r.profile_id, fullName: r.profiles?.full_name ?? "Unknown", phone: r.profiles?.phone ?? null, leads: r.is_group_leader }))
          .sort((a, b) => Number(b.leads) - Number(a.leads) || a.fullName.localeCompare(b.fullName)),
        past: meetings.data.map((m) => ({
          id: m.id,
          meetingAt: new Date(m.meeting_at),
          markedAt: m.attendance_marked_at ? new Date(m.attendance_marked_at) : null,
          myStatus: null,
          statuses: byMeeting.get(m.id) ?? {},
        })),
        lastContact,
      },
    });
  }, [groupId]);

  useFocusEffect(useCallback(() => void load(), [load]));
  return { state, reload: load };
}
