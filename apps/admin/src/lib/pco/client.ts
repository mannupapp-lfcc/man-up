import "server-only";

// Planning Center is READ-ONLY for Man Up (Non-negotiable 3). This client can only
// send GET requests: there is no method parameter, by design.

const BASE = "https://api.planningcenteronline.com";

export type PcoResource = {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, { data: { id: string; type: string } | { id: string; type: string }[] | null }>;
};
type PcoPage = { data: PcoResource[]; included?: PcoResource[]; links?: { next?: string } };

function authHeader() {
  const id = process.env.PCO_APP_ID;
  const secret = process.env.PCO_SECRET;
  if (!id || !secret) throw new Error("PCO_APP_ID and PCO_SECRET are not set");
  return "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
}

export async function pcoGet<T = PcoPage>(pathOrUrl: string): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : BASE + pathOrUrl;
  if (!url.startsWith(BASE)) throw new Error("PCO client only talks to api.planningcenteronline.com");
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { method: "GET", headers: { Authorization: authHeader() }, cache: "no-store" });
    if (res.status === 429) {
      // PCO allows 100 requests per 20 seconds; wait as told, then retry.
      const wait = Number(res.headers.get("Retry-After") ?? "5");
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`PCO GET ${new URL(url).pathname} failed: ${res.status}`);
    return (await res.json()) as T;
  }
  throw new Error("PCO rate limit: gave up after 5 tries");
}

// Follows links.next. `stop` ends early (e.g. once results are older than we need).
export async function pcoGetAll(path: string, stop?: (item: PcoResource) => boolean) {
  const data: PcoResource[] = [];
  const included: PcoResource[] = [];
  let next: string | undefined = path;
  while (next) {
    const page: PcoPage = await pcoGet(next);
    for (const item of page.data) {
      if (stop?.(item)) return { data, included };
      data.push(item);
    }
    included.push(...(page.included ?? []));
    next = page.links?.next;
  }
  return { data, included };
}
