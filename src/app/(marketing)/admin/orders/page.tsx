import { AdminOrders } from "@/components/admin/admin-orders";
import { requireOperationsPage } from "@/lib/server/operations-page";

export const metadata = { title: "Live orders" };

export default async function AdminOrdersPage() {
  await requireOperationsPage();
  return <AdminOrders />;
}
