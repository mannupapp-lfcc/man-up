import type { ReactNode } from "react";
import { SubmitButton } from "./SubmitButton";

// Small shared pieces for the admin screens. Plain server components.

export function Flash({ error, notice }: { error?: string | string[]; notice?: string | string[] }) {
  const e = typeof error === "string" ? error : undefined;
  const n = typeof notice === "string" ? notice : undefined;
  if (!e && !n) return null;
  return (
    <p role={e ? "alert" : "status"}
       className={`admin-flash rounded-md px-3 py-2 text-sm ${e ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"}`}>
      {e ?? n}
    </p>
  );
}

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="page-heading">
      <h1>{children}</h1>
      {sub ? <p className="page-description">{sub}</p> : null}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="admin-section">
      <h2 className="section-heading">{title}</h2>
      <div className="section-body">{children}</div>
    </section>
  );
}

export const inputClass =
  "admin-input";

export function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {text}
      {children}
    </label>
  );
}

export function Submit({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" }) {
  return <SubmitButton variant={variant}>{children}</SubmitButton>;
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
