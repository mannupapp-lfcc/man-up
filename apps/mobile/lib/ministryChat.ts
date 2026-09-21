import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";

export type MinistryMessage = { id: string; profile_id: string; body: string; mentions: string[]; created_at: string };
export type Person = { name: string; isLeader: boolean };

const COLUMNS = "id, profile_id, body, mentions, created_at";

// Ministry chat: every current member of the ministry reads it (RLS), minus men he
// has blocked. Names come from ministry_people() since profiles outside his group
// are not readable directly.
export function useMinistryChat() {
  const { state: auth } = useAuth();
  const ministryId = auth.status === "ready" ? auth.membership.ministryId : null;
  const [messages, setMessages] = useState<MinistryMessage[] | null>(null);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [error, setError] = useState(false);

  const loadPeople = useCallback(async () => {
    if (!ministryId) return;
    const { data } = await supabase.rpc("ministry_people", { p_ministry: ministryId });
    setPeople(new Map((data ?? []).map((p) => [p.profile_id, { name: p.full_name, isLeader: p.is_leader }])));
  }, [ministryId]);

  const load = useCallback(async () => {
    if (!ministryId) return;
    const [{ data, error: err }] = await Promise.all([
      supabase.from("ministry_messages").select(COLUMNS).eq("ministry_id", ministryId)
        .order("created_at", { ascending: false }).limit(50),
      loadPeople(),
    ]);
    setError(!!err);
    if (!err) setMessages(data ?? []);
  }, [ministryId, loadPeople]);

  useEffect(() => {
    if (!ministryId) return;
    void load();
    const channel = supabase
      .channel(`ministry-chat-${ministryId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ministry_messages", filter: `ministry_id=eq.${ministryId}` },
        (payload) => {
          const m = payload.new as MinistryMessage;
          setMessages((prev) => (prev?.some((x) => x.id === m.id) ? prev : [m, ...(prev ?? [])]));
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "ministry_messages" },
        (payload) => setMessages((prev) => prev?.filter((x) => x.id !== (payload.old as { id: string }).id) ?? null),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ministryId, load]);

  // A man who joined after the names loaded: fetch them again, once per unknown man
  // (a man who has left the ministry stays unnamed and must not loop).
  const asked = useRef(new Set<string>());
  useEffect(() => {
    const unknown = (messages ?? []).map((m) => m.profile_id).filter((id) => !people.has(id) && !asked.current.has(id));
    if (!unknown.length) return;
    unknown.forEach((id) => asked.current.add(id));
    void loadPeople();
  }, [messages, people, loadPeople]);

  // Posting goes through post_ministry_message: it keeps only valid tags and queues
  // the alerts (tagged men, and everyone when a leader posts).
  async function send(body: string, mentions: string[]) {
    if (!ministryId) return "Not signed in.";
    const { data, error: err } = await supabase.rpc("post_ministry_message", {
      p_ministry: ministryId, p_body: body, p_mentions: mentions,
    });
    if (err) return err.message;
    setMessages((prev) => (prev?.some((x) => x.id === data.id) ? prev : [data, ...(prev ?? [])]));
    return null;
  }

  async function remove(id: string) {
    await supabase.from("ministry_messages").delete().eq("id", id);
    setMessages((prev) => prev?.filter((x) => x.id !== id) ?? null);
  }

  return { messages, people, error, reload: load, send, remove };
}
