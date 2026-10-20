import { OrderDetailView } from "@/components/shared/order-detail-view";

export const metadata = { title: "Order detail" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function BusinessOrderDetail({ params }: PageProps) {
  const { id } = await params;
  return <OrderDetailView id={id} backHref="/business/orders" backLabel="All orders" actor="station" />;
}
