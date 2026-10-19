import type { Metadata } from "next";
import { RiderDelivery } from "@/components/order/rider-delivery";

export const metadata: Metadata = {
  title: "Delivery",
  robots: { index: false, follow: false },
  // The token in the URL is the rider's credential - never leak it to other sites.
  referrer: "no-referrer",
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function RiderPage({ params }: PageProps) {
  const { token } = await params;
  return <RiderDelivery token={token} />;
}
