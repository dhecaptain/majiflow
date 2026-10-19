import { DashboardShell } from "@/components/business/dashboard-shell";
import { AuthenticationError, requireBusinessOwner } from "@/lib/server/auth";
import { listOwnerStationIds } from "@/lib/server/stations";
import { redirect } from "next/navigation";

export const metadata = { title: "MajiFlow Business" };

interface LayoutProps {
  children: React.ReactNode;
}

export default async function BusinessLayout({ children }: LayoutProps) {
  let stationIds: string[];
  try {
    const owner = await requireBusinessOwner();
    stationIds = await listOwnerStationIds(owner.id);
  } catch (error) {
    if (error instanceof AuthenticationError) redirect("/login");
    throw error;
  }
  return <DashboardShell stationIds={stationIds}>{children}</DashboardShell>;
}