import { DashboardShell } from "@/components/business/dashboard-shell";
import { AuthenticationError, requireBusinessOwner } from "@/lib/server/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "MajiFlow Business" };

interface LayoutProps {
  children: React.ReactNode;
}

export default async function BusinessLayout({ children }: LayoutProps) {
  try {
    await requireBusinessOwner();
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    throw error;
  }
  return <DashboardShell>{children}</DashboardShell>;
}