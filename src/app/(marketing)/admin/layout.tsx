import { AdminNav } from "@/components/admin/admin-nav";
import { AdminSignIn, AdminSignOut, AdminWrongAccount } from "@/components/admin/admin-session";
import { Container } from "@/components/ui/container";
import { hasAdminSession } from "@/lib/server/admin";
import { getCurrentUser } from "@/lib/server/auth";

/** Private pages: never indexed. */
export const metadata = { robots: { index: false, follow: false } };

interface LayoutProps {
  children: React.ReactNode;
}

/** Platform admin is behind the operator key; every admin API re-checks it. */
export default async function AdminLayout({ children }: LayoutProps) {
  if (!(await hasAdminSession())) {
    return (
      <Container className="py-16 lg:py-24">
        <AdminSignIn />
      </Container>
    );
  }
  // A non-operations session would otherwise be redirected to "/" by every
  // page guard with no explanation.
  const user = await getCurrentUser();
  if (user && user.role !== "operations") {
    const who = user.email ?? user.phone ?? user.name ?? "another account";
    const kind = user.role === "business_owner" ? "a station account" : "a customer account";
    return (
      <Container className="py-16 lg:py-24">
        <AdminWrongAccount who={`${who} (${kind})`} />
      </Container>
    );
  }
  return (
    <>
      <Container className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 pt-6">
        <AdminNav />
        <AdminSignOut />
      </Container>
      {children}
    </>
  );
}
