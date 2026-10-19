import { AdminSignIn, AdminSignOut } from "@/components/admin/admin-session";
import { Container } from "@/components/ui/container";
import { hasAdminSession } from "@/lib/server/admin";

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
  return (
    <>
      <Container className="flex justify-end pt-6">
        <AdminSignOut />
      </Container>
      {children}
    </>
  );
}
