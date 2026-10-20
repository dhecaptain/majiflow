import { AdminOverview } from "@/components/admin/admin-overview";
import { requireOperationsPage } from "@/lib/server/operations-page";

export const metadata = { title: "Platform admin" };

export default async function Admin() {
  await requireOperationsPage();
  return <AdminOverview />;
}