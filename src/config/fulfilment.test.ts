import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PICKUP_ENABLED } from "@/config/fulfilment";
import { validateOrder } from "@/lib/server/order-store";

/**
 * Tripwire for the pickup gap.
 *
 * The UI hides pickup while `PICKUP_ENABLED` is false, because the order
 * pipeline cannot serve it yet: `validateOrder` demands a delivery address
 * on every order and recomputes the delivery fee from the station's own
 * rule. A customer who picked "Pickup" was never asked for an address (the
 * location modal skips it), so the checkout could not be completed - and no
 * "no delivery fee" figure would have been accepted.
 *
 * When pickup is built for real, replace this file with tests for the
 * fulfilment-aware validation rather than deleting it: the point is to make
 * the server work visible before the client starts offering the option.
 */

/** Mon 21 Sep 2026, 10:00 Nairobi: inside BioWater's 06:00-20:00 window. */
const OPEN_HOURS = new Date("2026-09-21T07:00:00Z");

/** A pickup order as the client would send it. */
function pickupPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-pickup-1",
    businessId: "bio-water-kasarani",
    businessName: "BioWater Refill Station",
    customerName: "Jane Wanjiku",
    customerPhone: "0712345678",
    items: [{ productId: "bw-refill-20", name: "Refill - 20L can", quantity: 2, unitPrice: 350 }],
    subtotal: 700,
    deliveryFee: 120,
    total: 820,
    payment: "mpesa",
    paymentState: "pending",
    status: "pending",
    address: { label: "Home", estate: "Kasarani", phone: "0712345678" },
    placedAt: "2026-09-21T10:42:00.000Z",
    fulfilment: "pickup",
    ...overrides,
  };
}

beforeEach(() => {
  // The order guard reads the wall clock, so freeze it.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(OPEN_HOURS);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pickup availability", () => {
  it("is switched off in the client", () => {
    expect(PICKUP_ENABLED).toBe(false);
  });

  it("cannot reach the order API without a delivery address", () => {
    const { order, errors } = validateOrder(pickupPayload({ address: undefined }));
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("address");
  });

  it("cannot reach the order API without the station's delivery fee", () => {
    const { order, errors } = validateOrder(pickupPayload({ deliveryFee: 0, total: 700 }));
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("deliveryFee");
  });
});
