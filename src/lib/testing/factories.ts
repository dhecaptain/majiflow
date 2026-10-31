import type { Order } from "@/lib/types";

/** Test-only order factory. Not imported by application code. */
export function makeOrder(partial: Partial<Order> = {}): Order {
  const id = partial.id ?? "order-1";
  return {
    id,
    // Order numbers are unique in the store, so each order id gets its own.
    orderNumber: `MF-${id.toUpperCase()}`,
    businessId: "bio-water-kasarani",
    businessName: "BioWater Refill Station",
    customerName: "Jane Wanjiku",
    customerPhone: "0712345678",
    items: [{ productId: "bw-refill-20", name: "Refill - 20L can", quantity: 2, unitPrice: 350 }],
    subtotal: 700,
    deliveryFee: 120,
    total: 820,
    payment: "mpesa",
    paymentState: "success",
    status: "delivered",
    address: { label: "Home", estate: "Kasarani", phone: "0712345678" },
    placedAt: "2026-09-21T10:42:00.000Z",
    eta: "≈ 50 min",
    timeline: [{ status: "delivered", at: "2026-09-21T10:42:00.000Z" }],
    location: null,
    locationHistory: [],
    ...partial,
  };
}
