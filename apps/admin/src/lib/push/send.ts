import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DbEnum } from "@manup/shared";
import { sendExpo, type ExpoMessage } from "./expo";

type Db = SupabaseClient<Database>;
type Kind = DbEnum<"push_kind">;
type Settings = Database["public"]["Tables"]["notification_settings"]["Row"];

// Which setting mutes each kind. Tags, attendance prompts, and leader digests are
// always on: a tag is someone speaking to him, and the other two are leader duties.
const SETTING: Partial<Record<Kind, keyof Settings>> = {
  group_message: "group_chat",
  ministry_post: "ministry_posts",
  meeting_reminder: "meeting_reminders",
  weekly_questions: "weekly_questions",
  checkin_prompt: "checkin_prompts",
};

// Where a tap lands in the app (Expo Router paths).
function linkFor(kind: Kind, refId: string | null) {
  switch (kind) {
    case "group_message": return "/group/chat";
    case "ministry_mention":
    case "ministry_post": return "/group/ministry-chat";
    case "meeting_reminder": return "/group/meetings";
    case "attendance_prompt": return refId ? `/group/attendance/${refId}` : "/group/meetings";
    case "weekly_questions": return "/group/questions";
    case "checkin_prompt": return "/group/checkin";
    case "leader_digest": return "/group/dashboard";
  }
}

const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] || "A brother";
const clip = (text: string, max = 140) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text);

export type SendSummary = { picked: number; sent: number; noDevice: number; muted: number; skipped: number; failed: number };

// Drains the push outbox: up to `limit` unsent rows, oldest first. Chat text is read
// from the message now (a deleted message is skipped). Recipients must still be
// current members of the row's ministry, and only that ministry's tokens are used.
export async function drainOutbox(db: Db, limit = 500): Promise<SendSummary> {
  const summary: SendSummary = { picked: 0, sent: 0, noDevice: 0, muted: 0, skipped: 0, failed: 0 };
  const { data: rows, error } = await db
    .from("push_outbox")
    .select("id, ministry_id, profile_id, kind, ref_id, title, body")
    .is("sent_at", null)
    .order("created_at")
    .limit(limit);
  if (error) throw new Error(`push_outbox: ${error.message}`);
  if (!rows?.length) return summary;
  summary.picked = rows.length;

  const profileIds = [...new Set(rows.map((r) => r.profile_id))];
  const ministryIds = [...new Set(rows.map((r) => r.ministry_id))];
  const groupMsgIds = rows.filter((r) => r.kind === "group_message" && r.ref_id).map((r) => r.ref_id!);
  const ministryMsgIds = rows.filter((r) => (r.kind === "ministry_mention" || r.kind === "ministry_post") && r.ref_id).map((r) => r.ref_id!);

  const [tokens, settings, members, groupMsgs, ministryMsgs] = await Promise.all([
    db.from("push_tokens").select("profile_id, ministry_id, expo_token").in("profile_id", profileIds),
    db.from("notification_settings").select("*").in("profile_id", profileIds),
    db.from("ministry_members").select("ministry_id, profile_id").in("profile_id", profileIds).in("ministry_id", ministryIds).is("left_at", null),
    groupMsgIds.length
      ? db.from("group_messages").select("id, ministry_id, body, profiles(full_name), groups(name)").in("id", [...new Set(groupMsgIds)])
      : Promise.resolve({ data: [], error: null }),
    ministryMsgIds.length
      ? db.from("ministry_messages").select("id, ministry_id, body, profiles(full_name)").in("id", [...new Set(ministryMsgIds)])
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [tokens, settings, members, groupMsgs, ministryMsgs]) if (r.error) throw new Error(r.error.message);

  const key = (ministryId: string, profileId: string) => `${ministryId}:${profileId}`;
  const tokensOf = new Map<string, string[]>();
  for (const t of tokens.data ?? []) tokensOf.set(key(t.ministry_id, t.profile_id), [...(tokensOf.get(key(t.ministry_id, t.profile_id)) ?? []), t.expo_token]);
  const settingsOf = new Map((settings.data ?? []).map((s) => [key(s.ministry_id, s.profile_id), s]));
  const isMember = new Set((members.data ?? []).map((m) => key(m.ministry_id, m.profile_id)));
  const groupMsg = new Map((groupMsgs.data ?? []).map((m) => [m.id, m]));
  const ministryMsg = new Map((ministryMsgs.data ?? []).map((m) => [m.id, m]));

  const results = new Map<string, string>();
  const outgoing: { rowId: string; message: ExpoMessage }[] = [];

  for (const r of rows) {
    const k = key(r.ministry_id, r.profile_id);
    if (!isMember.has(k)) { results.set(r.id, "not_member"); summary.skipped++; continue; }
    const setting = SETTING[r.kind];
    if (setting && settingsOf.get(k)?.[setting] === false) { results.set(r.id, "muted"); summary.muted++; continue; }

    let title = r.title;
    let body = r.body;
    if (r.kind === "group_message") {
      const m = r.ref_id ? groupMsg.get(r.ref_id) : undefined;
      if (!m || m.ministry_id !== r.ministry_id) { results.set(r.id, "deleted"); summary.skipped++; continue; }
      title = m.groups?.name ?? "Your group";
      body = `${firstName(m.profiles?.full_name)}: ${clip(m.body)}`;
    } else if (r.kind === "ministry_mention" || r.kind === "ministry_post") {
      const m = r.ref_id ? ministryMsg.get(r.ref_id) : undefined;
      if (!m || m.ministry_id !== r.ministry_id) { results.set(r.id, "deleted"); summary.skipped++; continue; }
      title = "Ministry chat";
      body = r.kind === "ministry_mention"
        ? `${firstName(m.profiles?.full_name)} tagged you: ${clip(m.body)}`
        : `${firstName(m.profiles?.full_name)}: ${clip(m.body)}`;
    }
    if (!title || !body) { results.set(r.id, "empty"); summary.skipped++; continue; }

    const to = tokensOf.get(k) ?? [];
    if (!to.length) { results.set(r.id, "no_device"); summary.noDevice++; continue; }
    for (const token of to) {
      outgoing.push({
        rowId: r.id,
        message: {
          to: token, title, body, sound: "default", channelId: "default",
          data: { url: linkFor(r.kind, r.ref_id), kind: r.kind, ministryId: r.ministry_id },
          ...(r.kind === "checkin_prompt" ? { categoryId: "checkin" } : {}),
        },
      });
    }
  }

  // A row counts as sent if any of his phones accepted it.
  const tickets = await sendExpo(outgoing.map((o) => o.message));
  const gone = new Set<string>();
  const outcome = new Map<string, { ok: boolean; error?: string }>();
  tickets.forEach((t, i) => {
    const o = outgoing[i]!;
    const prev = outcome.get(o.rowId);
    if (t.status === "ok") outcome.set(o.rowId, { ok: true });
    else {
      if (t.details?.error === "DeviceNotRegistered") gone.add(o.message.to);
      if (!prev?.ok) outcome.set(o.rowId, { ok: false, error: t.details?.error ?? t.message });
    }
  });
  for (const [rowId, o] of outcome) {
    results.set(rowId, o.ok ? "sent" : clip(`error: ${o.error ?? "unknown"}`, 200));
    if (o.ok) summary.sent++; else summary.failed++;
  }

  if (gone.size) {
    const del = await db.from("push_tokens").delete().in("expo_token", [...gone]);
    if (del.error) throw new Error(del.error.message);
  }

  // Record every row, grouped by result. Failed rows are marked too: a retry storm
  // against a broken token helps no one, and the next event queues a fresh row.
  const byResult = new Map<string, string[]>();
  for (const [rowId, result] of results) byResult.set(result, [...(byResult.get(result) ?? []), rowId]);
  const sentAt = new Date().toISOString();
  for (const [result, ids] of byResult) {
    for (let i = 0; i < ids.length; i += 200) {
      const up = await db.from("push_outbox").update({ sent_at: sentAt, result }).in("id", ids.slice(i, i + 200));
      if (up.error) throw new Error(up.error.message);
    }
  }

  // Keep the 0011 alert queue in step for ministry chat.
  const alertsByMessage = new Map<string, string[]>();
  for (const r of rows) {
    if ((r.kind === "ministry_mention" || r.kind === "ministry_post") && r.ref_id) {
      alertsByMessage.set(r.ref_id, [...(alertsByMessage.get(r.ref_id) ?? []), r.profile_id]);
    }
  }
  for (const [messageId, ids] of alertsByMessage) {
    for (let i = 0; i < ids.length; i += 200) {
      const up = await db.from("ministry_message_alerts").update({ sent_at: sentAt })
        .eq("message_id", messageId).in("profile_id", ids.slice(i, i + 200)).is("sent_at", null);
      if (up.error) throw new Error(up.error.message);
    }
  }

  return summary;
}

// Sent rows older than 30 days are not needed (dedupe keys are per week or per event).
export async function pruneOutbox(db: Db) {
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { error } = await db.from("push_outbox").delete().not("sent_at", "is", null).lt("sent_at", cutoff);
  if (error) throw new Error(error.message);
}
