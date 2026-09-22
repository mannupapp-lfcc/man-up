import { requireAdmin } from "@/lib/admin";

// Full-screen Studio, outside the admin chrome, behind the same admin check as every
// admin page.
export default async function StudioLayout({ children }: LayoutProps<"/studio">) {
  await requireAdmin();
  return children;
}
