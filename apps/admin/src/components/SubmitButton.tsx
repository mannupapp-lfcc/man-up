"use client";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, variant = "primary" }: { children: ReactNode; variant?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-busy={pending} className={`admin-button admin-button-${variant}`}>
    {pending ? <><span className="button-spinner" aria-hidden="true" />Working…</> : children}
  </button>;
}
