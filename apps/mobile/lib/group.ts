import type { DbEnum } from "@manup/shared";
import { useFocusEffect } from "expo-router";
import { createContext, createElement, useCallback, useContext, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export type AttendanceStatus = DbEnum<"attendance_status">;

export type RosterMan = { profileId: string; fullName: string; phone: string | null; leads: boolean };

export type Meeting = {
  id: string;
  meetingAt: Date;
  markedAt: Date | null;
  myStatus: AttendanceStatus | null;
  // Present only for leaders (RLS returns other men's rows to them alone).
  statuses: Record<string, AttendanceStatus>;
};

export type MyGroup = {
  groupId: string;
  name: string;
  meetingDay: string | null;
  meetingTime: string | null;
  iLead: boolean;
  roster: RosterMan[];
  past: Meeting[];
  upcoming: Meeting[];
};

// null = not placed in a group yet.
export type GroupState = { status: "loading" } | { status: "error" } | { status: "ready"; group: MyGroup | null };

const MS_72_HOURS = 72 * 60 * 60 * 1000;

// A meeting counts as held only if attendance was marked within 72 hours.
export function markedTooLate(m: Meeting) {
  const markedOrNow = m.markedAt ?? new Date();
  return markedOrNow.getTime() - m.meetingAt.getTime() > MS_72_HOURS;
}

export function useMyGroup() {
  const { state: auth } = useAuth();
  const [state, setState] = useState<GroupState>({ status: "loading" });
  const me = auth.status === "ready" ? auth.session.user.id : null;
  // Same rule as fn_leads_group in the database: flagged as a leader of this group
  // AND a co-leader, leader, or admin in the ministry.
  const leaderRole = auth.status === "ready" && auth.membership.role !== "member";

  const load = useCallback(async () => {
    if (!me) return;
    const mine = await supabase
      .from("group_members")
      .select("group_id, is_group_leader, groups(name, meeting_day, meeting_time)")
      .eq("profile_id", me)
      .is("left_at", null)
      .maybeSingle();
    if (mine.error) return setState({ status: "error" });
    if (!mine.data || !mine.data.groups) return setState({ status: "ready", group: null });

    const groupId = mine.data.group_id;
    const [roster, meetings] = await Promise.all([
      supabase
        .from("group_members")
        .select("profile_id, is_group_leader, profiles(full_name, phone)")
        .eq("group_id", groupId)
        .is("left_at", null),
      supabase
        .from("meetings")
        .select("id, meeting_at, attendance_marked_at")
        .eq("group_id", groupId)
        .order("meeting_at", { ascending: false })
        .limit(24),
    ]);
    if (roster.error || meetings.error) return setState({ status: "error" });

    // Scoped to this group's meetings: an admin who is also in a group can read
    // attendance ministry-wide, and this screen is about his group only.
    const attendance = await supabase
      .from("meeting_attendance")
      .select("meeting_id, profile_id, status")
      .in("meeting_id", meetings.data.map((m) => m.id));
    if (attendance.error) return setState({ status: "error" });

    const byMeeting = new Map<string, Record<string, AttendanceStatus>>();
    for (const a of attendance.data) {
      const row = byMeeting.get(a.meeting_id) ?? {};
      row[a.profile_id] = a.status;
      byMeeting.set(a.meeting_id, row);
    }

    const now = Date.now();
    const all: Meeting[] = meetings.data.map((m) => {
      const statuses = byMeeting.get(m.id) ?? {};
      return {
        id: m.id,
        meetingAt: new Date(m.meeting_at),
        markedAt: m.attendance_marked_at ? new Date(m.attendance_marked_at) : null,
        myStatus: statuses[me] ?? null,
        statuses,
      };
    });

    setState({
      status: "ready",
      group: {
        groupId,
        name: mine.data.groups.name,
        meetingDay: mine.data.groups.meeting_day,
        meetingTime: mine.data.groups.meeting_time,
        iLead: mine.data.is_group_leader && leaderRole,
        roster: roster.data
          .map((r) => ({
            profileId: r.profile_id,
            fullName: r.profiles?.full_name ?? "Unknown",
            phone: r.profiles?.phone ?? null,
            leads: r.is_group_leader,
          }))
          .sort((a, b) => Number(b.leads) - Number(a.leads) || a.fullName.localeCompare(b.fullName)),
        past: all.filter((m) => m.meetingAt.getTime() <= now).slice(0, 8),
        upcoming: all.filter((m) => m.meetingAt.getTime() > now).reverse().slice(0, 4),
      },
    });
  }, [me, leaderRole]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { state, reload: load };
}

// "You were there 5 of the last 6 meetings", counting only marked meetings.
export function myAttendanceSummary(past: Meeting[]) {
  const marked = past.filter((m) => m.markedAt);
  const present = marked.filter((m) => m.myStatus === "present").length;
  let streak = 0;
  for (const m of marked) {
    if (m.myStatus !== "present") break;
    streak++;
  }
  return { present, total: marked.length, streak };
}

export function formatMeeting(d: Date) {
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatSchedule(day: string | null, time: string | null) {
  if (!day) return null;
  if (!time) return `${day}s`;
  const [h = 0, m = 0] = time.split(":").map(Number);
  const t = new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day}s at ${t}`;
}

// One load of the group shared by every My Group screen (see app/(app)/group/_layout).
type GroupContextValue = ReturnType<typeof useMyGroup>;
const GroupContext = createContext<GroupContextValue | null>(null);

export function GroupProvider({ children }: { children: ReactNode }) {
  const value = useMyGroup();
  return createElement(GroupContext.Provider, { value }, children);
}

export function useGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroup must be used inside GroupProvider");
  return ctx;
}
