import type { DbEnum } from "@manup/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

export type ReactionKind = DbEnum<"message_reaction">;
export type Reaction = { id: string; message_id: string; profile_id: string; reaction: ReactionKind };

// Display order and labels for the message_reaction enum (0021).
export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "heart", emoji: "❤️", label: "Heart" },
  { kind: "thumbs_up", emoji: "👍", label: "Thumbs up" },
  { kind: "pray", emoji: "🙏", label: "Praying" },
  { kind: "amen", emoji: "🙌", label: "Amen" },
  { kind: "laugh", emoji: "😂", label: "Laughing" },
];

type Scope =
  | { table: "group_message_reactions"; column: "group_id"; value: string | null }
  | { table: "ministry_message_reactions"; column: "ministry_id"; value: string | null };

const COLUMNS = "id, message_id, profile_id, reaction";

// Reactions on the messages on screen. RLS decides who can read and add them (same
// readers as the chat, minus men he blocked); Realtime applies the same policy. A
// DELETE event carries only the id, so rows are kept by id.
export function useReactions(scope: Scope, messageIds: string[], me: string | null) {
  const [rows, setRows] = useState<Map<string, Reaction>>(new Map());
  const { table, column, value } = scope;
  const idsKey = messageIds.join(",");

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (!value || !ids.length) return setRows(new Map());
    const { data } = await supabase.from(table).select(COLUMNS).filter(column, "eq", value).in("message_id", ids);
    if (data) setRows(new Map((data as Reaction[]).map((r) => [r.id, r])));
  }, [table, column, value, idsKey]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!value) return;
    const channel = supabase
      .channel(`${table}-${value}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table, filter: `${column}=eq.${value}` }, (payload) => {
        const r = payload.new as Reaction;
        setRows((prev) => (prev.has(r.id) ? prev : new Map(prev).set(r.id, r)));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table }, (payload) => {
        const id = (payload.old as { id: string }).id;
        setRows((prev) => {
          if (!prev.has(id)) return prev;
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [table, column, value]);

  const byMessage = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of rows.values()) {
      const list = map.get(r.message_id);
      if (list) list.push(r);
      else map.set(r.message_id, [r]);
    }
    return map;
  }, [rows]);

  // Add his reaction, or take it back if he already gave this one. Returns an error
  // message or null. ministry_id and group_id are filled in by the database.
  async function toggle(messageId: string, kind: ReactionKind): Promise<string | null> {
    if (!me) return "Not signed in.";
    const mine = byMessage.get(messageId)?.find((r) => r.profile_id === me && r.reaction === kind);
    if (mine) {
      setRows((prev) => {
        const next = new Map(prev);
        next.delete(mine.id);
        return next;
      });
      const { error } = await supabase.from(table).delete().eq("id", mine.id);
      if (error) {
        setRows((prev) => new Map(prev).set(mine.id, mine));
        return error.message;
      }
      return null;
    }
    const { data, error } = await supabase
      .from(table)
      // ministry_id (and group_id) are left out on purpose: the 0021 trigger copies
      // them from the message. The generated Insert type cannot know that.
      .insert({ message_id: messageId, profile_id: me, reaction: kind } as never)
      .select(COLUMNS)
      .single();
    if (error) return error.code === "23505" ? null : error.message;
    const r = data as Reaction;
    setRows((prev) => new Map(prev).set(r.id, r));
    return null;
  }

  return { byMessage, toggle, reload: load };
}
