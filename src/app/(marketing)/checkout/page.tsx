import { CheckoutPage } from "@/components/order/checkout-page";

export const metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function Checkout() {
  return <CheckoutPage />;
}