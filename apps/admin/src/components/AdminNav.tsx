"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const groups = [
  { title: "Ministry", items: [
    { href: "/health", label: "Ministry health", icon: "M3 12h4l3-8 4 16 3-8h4" },
    { href: "/groups", label: "Groups", icon: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z" },
    { href: "/people", label: "People", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4" },
    { href: "/invites", label: "Invitations", icon: "M3 5h18v14H3z M3 5l9 8 9-8" },
  ] },
  { title: "Management", items: [
    { href: "/reports", label: "Reports", icon: "M5 21V3 M5 3c5-4 9 4 15 0v11c-6 4-10-4-15 0" },
    { href: "/content", label: "Content", icon: "M4 3h12l4 4v14H4z M15 3v5h5 M8 12h8 M8 16h6" },
    { href: "/pco", label: "Planning Center", icon: "M3 7h17l-4-4 M21 17H4l4 4" },
    { href: "/scoring", label: "Scoring settings", icon: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6" },
  ] },
];

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.items).find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  return (
    <>
      <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="admin-navigation" onClick={() => setOpen(!open)}>
        <span>{current?.label ?? "Navigation"}</span><span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <nav id="admin-navigation" aria-label="Main navigation" className={`admin-nav ${open ? "is-open" : ""}`}>
        {groups.map((group) => (
          <div key={group.title} className="nav-group">
            <p className="nav-heading">{group.title}</p>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="nav-link" onClick={() => setOpen(false)}>
                <svg className="nav-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={item.icon} /></svg>{item.label}
                {active ? <span className="nav-dot" aria-hidden="true" /> : null}
              </Link>;
            })}
          </div>
        ))}
      </nav>
    </>
  );
}
