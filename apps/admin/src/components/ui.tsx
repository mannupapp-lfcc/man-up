import type { ReactNode } from "react";

// Small shared pieces for the admin screens. Plain server components.

export function Flash({ error, notice }: { error?: string | string[]; notice?: string | string[] }) {
  const e = typeof error === "string" ? error : undefined;
  const n = typeof notice === "string" ? notice : undefined;
  if (!e && !n) return null;
  return (
    <p role={e ? "alert" : "status"}
       className={`rounded-md px-3 py-2 text-sm ${e ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"}`}>
      {e ?? n}
    </p>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-neutral-500">{sub}</p> : null}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export const inputClass =
  "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40 dark:border-navy dark:bg-navy-deep";

export function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {text}
      {children}
    </label>
  );
}

export function Submit({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" }) {
  const styles = {
    primary: "bg-gold text-black hover:bg-gold-light",
    secondary: "border border-navy/30 text-navy hover:bg-navy/5 dark:border-gold/40 dark:text-white dark:hover:bg-navy",
    danger: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
  }[variant];
  return (
    <button type="submit" className={`rounded-md px-3 py-2 text-sm font-medium ${styles}`}>
      {children}
    </button>
  );
}

export const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const ROLE_LABEL: Record<string, string> = {
  member: "Member",
  co_leader: "Co-leader",
  leader: "Leader",
  admin: "Admin",
};

export function formatTime(t: string | null) {
  if (!t) return "";
  const [h = 0, m = 0] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// Date helpers kept out of component bodies (server components render once per request).
export function daysAgo(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function isPast(iso: string | null) {
  return !!iso && new Date(iso).getTime() < Date.now();
}
