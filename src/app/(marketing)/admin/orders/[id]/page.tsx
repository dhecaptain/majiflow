import { OrderDetailView } from "@/components/shared/order-detail-view";
import { requireOperationsPage } from "@/lib/server/operations-page";

export const metadata = { title: "Track order" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderDetail({ params }: PageProps) {
  await requireOperationsPage();
  const { id } = await params;
  return <OrderDetailView id={id} backHref="/admin/orders" backLabel="Live orders" actor="admin" />;
}
