import type { DbEnum } from "@manup/shared";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export type Visibility = DbEnum<"prayer_visibility">;

export type PrayerRequest = {
  id: string;
  body: string;
  answered: boolean;
  answeredNote: string | null;
  visibility: Visibility;
  anonymous: boolean;
  createdAt: Date;
  authorId: string | null; // null when anonymous and not his own
  authorName: string | null;
  isMine: boolean;
  prayedCount: number;
  iPrayed: boolean;
  commentCount: number;
};

export type PrayerComment = { id: string; body: string; authorId: string; authorName: string; isMine: boolean; createdAt: Date };

type WallState = { status: "loading" } | { status: "error" } | { status: "ready"; requests: PrayerRequest[] };

// Everything goes through prayer_wall(): it applies group/ministry visibility, keeps
// anonymous authors hidden, and leaves out men he has blocked.
export function usePrayerWall() {
  const { state: auth } = useAuth();
  const [state, setState] = useState<WallState>({ status: "loading" });
  const ministryId = auth.status === "ready" ? auth.membership.ministryId : null;

  const load = useCallback(async () => {
    if (!ministryId) return;
    const { data, error } = await supabase.rpc("prayer_wall", { p_ministry: ministryId });
    if (error) return setState({ status: "error" });
    setState({
      status: "ready",
      requests: data.map((r) => ({
        id: r.id,
        body: r.body,
        answered: r.status === "answered",
        answeredNote: r.answered_note,
        visibility: r.visibility,
        anonymous: r.is_anonymous,
        createdAt: new Date(r.created_at),
        authorId: r.author_id,
        authorName: r.author_name,
        isMine: r.is_mine,
        prayedCount: r.prayed_count,
        iPrayed: r.i_prayed,
        commentCount: r.comment_count,
      })),
    });
  }, [ministryId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { state, reload: load, ministryId };
}

export async function setPrayed(ministryId: string, requestId: string, me: string, prayed: boolean) {
  const { error } = prayed
    ? await supabase.from("prayer_interactions").insert({ ministry_id: ministryId, prayer_request_id: requestId, profile_id: me, kind: "prayed" })
    : await supabase.from("prayer_interactions").delete().eq("prayer_request_id", requestId).eq("profile_id", me).eq("kind", "prayed");
  return error?.message ?? null;
}

export async function postRequest(input: {
  ministryId: string;
  me: string;
  body: string;
  anonymous: boolean;
  visibility: Visibility;
  groupId: string | null;
}) {
  const { error } = await supabase.from("prayer_requests").insert({
    ministry_id: input.ministryId,
    profile_id: input.me,
    body: input.body.trim(),
    is_anonymous: input.anonymous,
    visibility: input.visibility,
    group_id: input.visibility === "group" ? input.groupId : input.groupId ?? null,
  });
  return error?.message ?? null;
}

export async function markAnswered(requestId: string, note: string) {
  const { error } = await supabase
    .from("prayer_requests")
    .update({ status: "answered", answered_note: note.trim() || null })
    .eq("id", requestId);
  return error?.message ?? null;
}

export async function changeVisibility(requestId: string, visibility: Visibility, groupId: string | null) {
  const { error } = await supabase
    .from("prayer_requests")
    .update(visibility === "group" ? { visibility, group_id: groupId } : { visibility })
    .eq("id", requestId);
  return error?.message ?? null;
}

export async function deleteRequest(requestId: string) {
  // Prayers and comments on it go first (they reference it).
  await supabase.from("prayer_interactions").delete().eq("prayer_request_id", requestId);
  const { error } = await supabase.from("prayer_requests").delete().eq("id", requestId);
  return error?.message ?? null;
}

export async function loadComments(requestId: string): Promise<PrayerComment[] | null> {
  const { data, error } = await supabase.rpc("prayer_comments", { p_request: requestId });
  if (error) return null;
  return data.map((c) => ({
    id: c.id,
    body: c.body,
    authorId: c.author_id,
    authorName: c.author_name,
    isMine: c.is_mine,
    createdAt: new Date(c.created_at),
  }));
}

export async function addComment(ministryId: string, requestId: string, me: string, body: string) {
  const { error } = await supabase
    .from("prayer_interactions")
    .insert({ ministry_id: ministryId, prayer_request_id: requestId, profile_id: me, kind: "comment", body: body.trim() });
  return error?.message ?? null;
}

// ---------- Safety: report and block (shared with group chat) ----------

export async function report(ministryId: string, me: string, targetType: DbEnum<"report_target">, targetId: string, reason?: string) {
  const { error } = await supabase
    .from("content_reports")
    .insert({ ministry_id: ministryId, reporter_id: me, target_type: targetType, target_id: targetId, reason: reason ?? null });
  return error?.message ?? null;
}

export async function block(ministryId: string, me: string, profileId: string) {
  const { error } = await supabase.from("user_blocks").insert({ ministry_id: ministryId, blocker_id: me, blocked_id: profileId });
  return error?.message ?? null;
}

export function timeAgo(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
