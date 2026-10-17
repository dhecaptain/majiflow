import { describe, expect, it } from "vitest";
import {
  PAYMENT_CONFIRMATION_WINDOW_MS,
  buildAccountEvents,
  cancelBlockReason,
  computeAccountMetrics,
  countUnread,
  filterOrders,
  isOrderFilter,
  planReorder,
} from "@/lib/account";
import type { Business, Order } from "@/lib/types";

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: "o1",
    orderNumber: "MF-1",
    businessId: "station",
    businessName: "Station",
    customerName: "Jane",
    customerPhone: "+254712345678",
    items: [{ productId: "p1", name: "Refill 20L", quantity: 2, unitPrice: 300 }],
    subtotal: 600,
    deliveryFee: 100,
    total: 700,
    payment: "mpesa",
    paymentState: "success",
    status: "delivered",
    address: { label: "Home", estate: "Kasarani", phone: "+254712345678" },
    placedAt: "2026-09-21T07:00:00.000Z",
    ...overrides,
  };
}

const catalog = [
  {
    id: "station",
    name: "Station",
    products: [
      { id: "p1", name: "Refill 20L", price: 350, stock: 10 },
      { id: "p2", name: "Bottle 1L", price: 50, stock: 0 },
      { id: "p3", name: "Dispenser", price: 2000, stock: 1 },
    ],
  },
] as unknown as Business[];

describe("computeAccountMetrics", () => {
  it("counts only verified payments towards total spent", () => {
    const metrics = computeAccountMetrics([
      order(),
      order({ id: "o2", status: "pending", paymentState: "pending", total: 500 }),
      order({ id: "o3", status: "cancelled", paymentState: "refunded", total: 900 }),
      order({ id: "o4", status: "out_for_delivery", paymentState: "success", total: 300 }),
    ]);
    expect(metrics).toEqual({
      activeOrders: 2,
      ordersPlaced: 4,
      deliveredOrders: 1,
      cansDelivered: 2,
      totalSpent: 1000,
    });
  });

  it("is all zeros for a new customer", () => {
    expect(computeAccountMetrics([])).toEqual({
      activeOrders: 0,
      ordersPlaced: 0,
      deliveredOrders: 0,
      cansDelivered: 0,
      totalSpent: 0,
    });
  });
});

describe("filterOrders", () => {
  const orders = [order({ id: "a", status: "pending" }), order({ id: "b", status: "rejected" })];

  it("splits active and past orders", () => {
    expect(filterOrders(orders, "active").map((o) => o.id)).toEqual(["a"]);
    expect(filterOrders(orders, "past").map((o) => o.id)).toEqual(["b"]);
    expect(filterOrders(orders, "all")).toHaveLength(2);
  });

  it("recognises only known filters", () => {
    expect(isOrderFilter("active")).toBe(true);
    expect(isOrderFilter("everything")).toBe(false);
  });
});

describe("account events", () => {
  const orders = [
    order({
      timeline: [
        { status: "pending", at: "2026-09-21T07:00:00.000Z" },
        { status: "accepted", at: "2026-09-21T07:05:00.000Z" },
      ],
    }),
    order({ id: "o2", orderNumber: "MF-2", status: "pending", placedAt: "2026-09-21T08:00:00.000Z" }),
  ];

  it("lists real timeline entries newest first, with a placed event for orders without a timeline", () => {
    const events = buildAccountEvents(orders);
    expect(events.map((e) => `${e.orderNumber}:${e.status}`)).toEqual(["MF-2:pending", "MF-1:accepted", "MF-1:pending"]);
    expect(new Set(events.map((e) => e.id)).size).toBe(3);
  });

  it("counts events after the last read time as unread", () => {
    const events = buildAccountEvents(orders);
    expect(countUnread(events, null)).toBe(3);
    expect(countUnread(events, "2026-09-21T07:02:00.000Z")).toBe(2);
    expect(countUnread(events, "2026-09-21T09:00:00.000Z")).toBe(0);
  });
});

describe("cancelBlockReason", () => {
  const placed = Date.parse("2026-09-21T07:00:00.000Z");

  it("allows cancelling a pending order whose payment failed", () => {
    expect(cancelBlockReason(order({ status: "pending", paymentState: "failed" }), placed)).toBeNull();
  });

  it("blocks accepted orders and paid orders", () => {
    expect(cancelBlockReason(order({ status: "accepted", paymentState: "failed" }), placed)).toMatch(/accepted/);
    expect(cancelBlockReason(order({ status: "pending", paymentState: "success" }), placed)).toMatch(/refund/);
  });

  it("waits out the payment confirmation window", () => {
    const pending = order({ status: "pending", paymentState: "pending" });
    expect(cancelBlockReason(pending, placed + 60_000)).toMatch(/confirmed/);
    expect(cancelBlockReason(pending, placed + PAYMENT_CONFIRMATION_WINDOW_MS + 1)).toBeNull();
  });
});

describe("planReorder", () => {
  it("rebuilds the cart at today's prices and explains what changed", () => {
    const plan = planReorder(
      order({
        items: [
          { productId: "p1", name: "Refill 20L", quantity: 2, unitPrice: 300 },
          { productId: "p2", name: "Bottle 1L", quantity: 3, unitPrice: 50 },
          { productId: "p3", name: "Dispenser", quantity: 2, unitPrice: 2000 },
          { productId: "gone", name: "Old item", quantity: 1, unitPrice: 10 },
        ],
      }),
      catalog
    );
    if ("error" in plan) throw new Error(plan.error);
    expect(plan.lines).toEqual([
      { businessId: "station", productId: "p1", quantity: 2 },
      { businessId: "station", productId: "p3", quantity: 1 },
    ]);
    expect(plan.priceChanges).toEqual([{ name: "Refill 20L", from: 300, to: 350 }]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(["Out of stock", "Only 1 available", "No longer sold"]);
  });

  it("refuses when the station or every item is gone", () => {
    expect(planReorder(order({ businessId: "closed" }), catalog)).toEqual({
      error: "Station is no longer on MajiFlow.",
    });
    expect(planReorder(order({ items: [{ productId: "p2", name: "Bottle 1L", quantity: 1, unitPrice: 50 }] }), catalog)).toHaveProperty(
      "error"
    );
  });
});
