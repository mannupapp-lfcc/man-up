import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@manup/shared";
import { pcoGet, pcoGetAll, type PcoResource } from "./client";

type Db = SupabaseClient<Database>;

// How far back the mirror keeps events and check-ins (the longest scoring window
// is 60 days), and how far ahead events are listed.
const DAYS_BACK = 60;
const DAYS_AHEAD = 365;

export type SyncSummary = {
  ministryId: string;
  skipped?: string;
  roster?: number;
  events?: number;
  checkIns?: number;
  errors: string[];
};

type Config = { groupId: string | null; checkInEventIds: string[] };

async function readConfig(db: Db, ministryId: string): Promise<Config> {
  const { data } = await db
    .from("ministry_config")
    .select("key, value")
    .eq("ministry_id", ministryId)
    .in("key", ["pco_group_id", "pco_checkin_event_ids"]);
  const get = (k: string) => data?.find((r) => r.key === k)?.value;
  const group = get("pco_group_id");
  const events = get("pco_checkin_event_ids");
  return {
    groupId: typeof group === "string" && group ? group : null,
    checkInEventIds: Array.isArray(events) ? events.filter((e): e is string => typeof e === "string") : [],
  };
}

// PCO Groups returns emails and phones as arrays; take the primary one if marked.
function pickContact(list: unknown, field: "address" | "number"): string | null {
  if (!Array.isArray(list) || list.length === 0) return null;
  const items = list as Array<Record<string, unknown> | string>;
  const primary = items.find((i) => typeof i === "object" && i !== null && i.primary === true) ?? items[0];
  if (typeof primary === "string") return primary;
  const value = primary?.[field] ?? primary?.["value"];
  return typeof value === "string" ? value : null;
}

const relId = (r: PcoResource, name: string) => {
  const d = r.relationships?.[name]?.data;
  return d && !Array.isArray(d) ? d.id : null;
};

// Reads PCO for one ministry and mirrors it. With dryRun, reads everything and
// writes nothing. Only GET requests reach PCO (see ./client).
export async function syncMinistry(db: Db, ministryId: string, { dryRun = false } = {}): Promise<SyncSummary> {
  const summary: SyncSummary = { ministryId, errors: [] };
  const config = await readConfig(db, ministryId);
  if (!config.groupId) return { ...summary, skipped: "No pco_group_id configured" };
  const groupId = config.groupId;

  const log = async (resource: "roster" | "events" | "gathering_attendance", rows: number, error?: string) => {
    if (dryRun) return;
    await db.from("pco_sync_log").insert({ ministry_id: ministryId, resource, rows_upserted: rows, status: error ? "error" : "ok", error });
  };

  // ---------- Roster ----------
  try {
    const { data, included } = await pcoGetAll(`/groups/v2/groups/${groupId}/memberships?per_page=100&include=person`);
    const people = new Map(included.filter((i) => i.type === "Person").map((p) => [p.id, p]));
    const rows = data.flatMap((m) => {
      const personId = relId(m, "person");
      const person = personId ? people.get(personId) : undefined;
      if (!personId || !person) return [];
      const a = person.attributes;
      return [{
        ministry_id: ministryId,
        pco_person_id: personId,
        full_name: [a.first_name, a.last_name].filter(Boolean).join(" ") || null,
        email: pickContact(a.email_addresses, "address"),
        phone: pickContact(a.phone_numbers, "number"),
        synced_at: new Date().toISOString(),
      }];
    });
    summary.roster = rows.length;
    if (!dryRun) {
      const up = await db.from("pco_roster").upsert(rows, { onConflict: "ministry_id,pco_person_id" });
      if (up.error) throw new Error(up.error.message);
      // Men no longer in the PCO group leave the mirror (not seed rows).
      const keep = new Set(rows.map((r) => r.pco_person_id));
      const { data: existing } = await db.from("pco_roster").select("pco_person_id").eq("ministry_id", ministryId);
      const gone = (existing ?? []).map((r) => r.pco_person_id).filter((id) => !keep.has(id) && !id.startsWith("seed-"));
      if (gone.length) await db.from("pco_roster").delete().eq("ministry_id", ministryId).in("pco_person_id", gone);
    }
    await log("roster", rows.length);
  } catch (e) {
    summary.errors.push(`roster: ${(e as Error).message}`);
    await log("roster", 0, (e as Error).message);
  }

  // ---------- Events -> gatherings ----------
  try {
    const group = await pcoGet<{ data: PcoResource }>(`/groups/v2/groups/${groupId}`);
    const churchCenterUrl = (group.data.attributes.public_church_center_web_url as string | null) ?? null;
    const from = new Date(Date.now() - DAYS_BACK * 86_400_000).toISOString();
    const to = new Date(Date.now() + DAYS_AHEAD * 86_400_000).toISOString();
    const { data, included } = await pcoGetAll(
      `/groups/v2/groups/${groupId}/events?per_page=100&include=location&where[starts_at][gte]=${from}&where[starts_at][lte]=${to}`,
    );
    const locations = new Map(included.filter((i) => i.type === "Location").map((l) => [l.id, l]));
    const rows = data.map((e) => {
      const a = e.attributes;
      const loc = locations.get(relId(e, "location") ?? "");
      return {
        ministry_id: ministryId,
        pco_group_event_id: e.id,
        title: String(a.name ?? "Gathering").trim(),
        gathering_at: a.starts_at as string,
        ends_at: (a.ends_at as string | null) ?? null,
        canceled: a.canceled === true,
        location: (loc?.attributes.name as string | undefined) ?? (loc?.attributes.full_formatted_address as string | undefined) ?? null,
        church_center_url: churchCenterUrl,
        synced_at: new Date().toISOString(),
      };
    });
    summary.events = rows.length;
    if (!dryRun && rows.length) {
      const up = await db.from("gatherings").upsert(rows, { onConflict: "ministry_id,pco_group_event_id" });
      if (up.error) throw new Error(up.error.message);
    }
    await log("events", rows.length);
  } catch (e) {
    summary.errors.push(`events: ${(e as Error).message}`);
    await log("events", 0, (e as Error).message);
  }

  // ---------- Check-ins -> attendance ----------
  if (config.checkInEventIds.length) {
    try {
      const cutoff = Date.now() - DAYS_BACK * 86_400_000;
      let total = 0;
      for (const eventId of config.checkInEventIds) {
        // Newest first; stop at the cutoff. Only who and when are kept (never the
        // notes, emergency contacts, or security codes a check-in carries).
        const { data } = await pcoGetAll(
          `/check_ins/v2/events/${eventId}/check_ins?per_page=100&order=-created_at`,
          (ci) => new Date(ci.attributes.created_at as string).getTime() < cutoff,
        );
        const rows = data.flatMap((ci) => {
          const personId = relId(ci, "person");
          if (!personId) return []; // one-time guests have no person
          return [{
            ministry_id: ministryId,
            pco_person_id: personId,
            pco_event_id: eventId,
            pco_check_in_id: ci.id,
            event_at: ci.attributes.created_at as string,
            synced_at: new Date().toISOString(),
          }];
        });
        total += rows.length;
        if (!dryRun && rows.length) {
          const up = await db.from("pco_gathering_attendance").upsert(rows, { onConflict: "ministry_id,pco_check_in_id" });
          if (up.error) throw new Error(up.error.message);
        }
      }
      summary.checkIns = total;
      await log("gathering_attendance", total);
    } catch (e) {
      summary.errors.push(`check-ins: ${(e as Error).message}`);
      await log("gathering_attendance", 0, (e as Error).message);
    }
  }

  return summary;
}

// Every ministry with a PCO group configured, each against its own config.
export async function syncAllMinistries(db: Db) {
  const { data } = await db.from("ministry_config").select("ministry_id").eq("key", "pco_group_id");
  const results: SyncSummary[] = [];
  for (const row of data ?? []) results.push(await syncMinistry(db, row.ministry_id));
  return results;
}
