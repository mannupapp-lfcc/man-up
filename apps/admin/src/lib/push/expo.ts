import "server-only";

// Expo push service (https://docs.expo.dev/push-notifications/sending-notifications/).
// The only push provider this app talks to. EXPO_ACCESS_TOKEN is optional: set it
// only if "enhanced push security" is turned on for the Expo project.

const ENDPOINT = "https://exp.host/--/api/v2/push/send";
const BATCH = 100;

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound: "default";
  channelId: "default";
  categoryId?: string;
};

export type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

// Sends every message and returns one ticket per message, in order. A failed batch
// comes back as error tickets instead of throwing, so one bad batch never blocks
// the rest.
export async function sendExpo(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const tickets: ExpoTicket[] = [];
  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      const json = (await res.json().catch(() => null)) as { data?: ExpoTicket[]; errors?: { message: string }[] } | null;
      if (!res.ok || !Array.isArray(json?.data)) {
        const message = json?.errors?.[0]?.message ?? `Expo push HTTP ${res.status}`;
        tickets.push(...batch.map(() => ({ status: "error" as const, message })));
        continue;
      }
      tickets.push(...json.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      tickets.push(...batch.map(() => ({ status: "error" as const, message })));
    }
  }
  return tickets;
}
