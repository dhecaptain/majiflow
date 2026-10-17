import { OrderDetailPage } from "@/components/account/order-detail";

export const metadata = { title: "Order details" };

export default async function AccountOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailPage id={id} />;
}
