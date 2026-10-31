import { DashboardShell } from "@/components/business/dashboard-shell";
import { AuthenticationError, requireBusinessOwner } from "@/lib/server/auth";
import { listOwnerCatalogStations } from "@/lib/server/catalog";
import type { Business } from "@/lib/types";
import { redirect } from "next/navigation";

export const metadata = { title: "MajiFlow Business", robots: { index: false, follow: false } };

interface LayoutProps {
  children: React.ReactNode;
}

export default async function BusinessLayout({ children }: LayoutProps) {
  let stations: Business[];
  try {
    const owner = await requireBusinessOwner();
    stations = await listOwnerCatalogStations(owner.id);
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    throw error;
  }
  return <DashboardShell stations={stations}>{children}</DashboardShell>;
}