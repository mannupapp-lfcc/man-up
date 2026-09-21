import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { signOut } from "../login/actions";

const NAV = [
  { href: "/groups", label: "Groups" },
  { href: "/people", label: "People" },
  { href: "/invites", label: "Invite codes" },
  { href: "/pco", label: "Planning Center" },
  { href: "/reports", label: "Reports" },
  { href: "/content", label: "Content" },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { ministryName } = await requireAdmin();
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b-2 border-gold bg-black text-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/groups" className="flex items-center gap-2 font-bold text-gold">
            <Image src="/logo.png" alt="" width={32} height={32} className="rounded-md" />
            {ministryName} Admin
          </Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-white/90 hover:text-gold">
              {n.label}
            </Link>
          ))}
          <form action={signOut} className="ml-auto">
            <button type="submit" className="text-sm text-white/70 hover:text-gold">Sign out</button>
          </form>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
