import { BusinessRegister } from "@/components/business/business-register";

export const metadata = {
  title: "List your water business",
  description: "Apply to sell refills on MajiFlow: a storefront, an order dashboard and a 14-day free trial.",
  alternates: { canonical: "/business/register" },
};

export default function BusinessRegisterPage() {
  return <BusinessRegister />;
}