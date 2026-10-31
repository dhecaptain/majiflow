import { TrackOrderPage } from "@/components/order/track-order";

// A tracking link is private to whoever holds it.
export const metadata = { title: "Track your order", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderTrack({ params }: PageProps) {
  const { id } = await params;
  return <TrackOrderPage id={id} />;
}