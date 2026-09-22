import Image from "next/image";
import Link from "next/link";
import { AdminNav } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/admin";
import { signOut } from "../login/actions";

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const { ministryName } = await requireAdmin();
  return (
    <div className="admin-shell">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <aside className="admin-sidebar">
        <Link href="/health" className="admin-brand">
          <Image src="/logo.png" alt="" width={48} height={48} className="rounded-xl" />
          <span><strong>MAN UP<span className="brand-period">.</span></strong><small>MINISTRY ADMIN</small></span>
        </Link>
        <AdminNav />
        <div className="sidebar-footer">
          <p>Men of faith.<br /><strong>Leaders of purpose.</strong></p>
          <form action={signOut}><button type="submit" className="sign-out">Sign out <span aria-hidden="true">↗</span></button></form>
        </div>
      </aside>
      <div className="admin-workspace">
        <header className="workspace-header">
          <div><span className="workspace-label">Your ministry</span><p>{ministryName}</p></div>
          <span className="admin-role"><span aria-hidden="true">◆</span> Administrator</span>
        </header>
        <main id="main-content" tabIndex={-1} className="admin-main">{children}</main>
        <footer className="workspace-footer">Man Up <span>Built around brotherhood.</span></footer>
      </div>
    </div>
  );
}
