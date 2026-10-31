import { CartPage } from "@/components/order/cart-page";

export const metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default function Cart() {
  return <CartPage />;
}