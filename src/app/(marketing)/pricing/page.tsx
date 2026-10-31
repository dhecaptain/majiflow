import { PricingPage } from "@/components/marketing/pricing-page";

export const metadata = {
  title: "Pricing",
  description:
    "Simple monthly plans for water refill stations. Every plan starts with a 14-day free trial, with no commission on orders.",
  alternates: { canonical: "/pricing" },
};

export default function Pricing() {
  return <PricingPage />;
}