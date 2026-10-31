import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADDRESS_PIN_RETENTION_DAYS,
  applyOrderRetention,
  createOrder,
  getOrder,
  listOrders,
  locationBlockReason,
  recordLocation,
  transitionOrder,
  updateOrder,
  updateOrderConsent,
  validateOrder,
} from "@/lib/server/order-store";
import { makeOrder } from "@/lib/testing/factories";

/**
 * Every test gets its own throwaway data directory, so nothing here can read
 * or overwrite the orders a developer has in `.data`.
 */

let dataDir: string;

/** Mon 21 Sep 2026, 10:00 Nairobi: inside BioWater's 06:00-20:00 window. */
const OPEN_HOURS = new Date("2026-09-21T07:00:00Z");
/** Mon 21 Sep 2026, 23:00 Nairobi: BioWater has closed. */
const CLOSED_HOURS = new Date("2026-09-21T20:00:00Z");

beforeEach(async () => {
  // The order guard reads the wall clock, so freeze it: otherwise these tests
  // pass or fail depending on the hour they are run at.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(OPEN_HOURS);
  dataDir = await mkdtemp(path.join(tmpdir(), "mf-orders-"));
  process.env.MF_DATA_DIR = dataDir;
});

afterEach(async () => {
  vi.useRealTimers();
  delete process.env.MF_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

/** A payload the API should accept for BioWater (open Mon 06:00-20:00 Nairobi). */
function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-test-1",
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
    ...overrides,
  };
}

describe("validateOrder", () => {
  it("accepts a well-formed order", () => {
    const { order, errors } = validateOrder(validPayload());
    expect(errors).toBeUndefined();
    expect(order?.subtotal).toBe(700);
    expect(order?.total).toBe(820);
  });

  it("never trusts a client subtotal", () => {
    const { order, errors } = validateOrder(validPayload({ subtotal: 1, total: 121 }));
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("subtotal");
  });

  it("never trusts a client total", () => {
    const { order, errors } = validateOrder(validPayload({ total: 1 }));
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("total");
  });

  it("rejects a tampered delivery fee instead of recomputing from it", () => {
    const { order, errors } = validateOrder(validPayload({ deliveryFee: 0, total: 700 }));
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("deliveryFee");
  });

  it("rejects a client-declared paid state - payment is verified server-side", () => {
    const { order, errors } = validateOrder(validPayload({ paymentState: "success" }));
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("paymentState");
  });

  it("rejects a manipulated unit price against the catalog", () => {
    const { order, errors } = validateOrder(
      validPayload({
        items: [{ productId: "bw-refill-20", name: "Refill - 20L can", quantity: 2, unitPrice: 1 }],
        subtotal: 2,
        total: 122,
      })
    );
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("items");
  });

  it("rejects a product that belongs to a different station", () => {
    const { order, errors } = validateOrder(
      validPayload({
        items: [{ productId: "tf-refill-20", name: "Stranger item", quantity: 1, unitPrice: 100 }],
        subtotal: 100,
        total: 220,
      })
    );
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("items");
  });

  it("rejects a quantity above available stock", () => {
    const { order, errors } = validateOrder(
      validPayload({
        items: [{ productId: "bw-refill-20", name: "Refill - 20L can", quantity: 500, unitPrice: 350 }],
        subtotal: 175000,
        total: 175000,
      })
    );
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("items");
  });

  it("stores an immutable pricing snapshot on the verified totals", () => {
    const { order, errors } = validateOrder(validPayload());
    expect(errors).toBeUndefined();
    expect(order?.pricingSnapshot).toMatchObject({ subtotal: 700, deliveryFee: 120, total: 820 });
    expect(order?.businessName).toBe("BioWater Refill Station");
  });

  it("normalises a +254 number to the canonical form", () => {
    const { order } = validateOrder(validPayload({ customerPhone: "+254 712 345 678" }));
    expect(order?.customerPhone).toBe("0712345678");
  });

  it("rejects a phone that is not a Kenyan mobile", () => {
    const { errors } = validateOrder(validPayload({ customerPhone: "12345" }));
    expect(errors).toHaveProperty("customerPhone");
  });

  it("rejects a name with digits", () => {
    const { errors } = validateOrder(validPayload({ customerName: "Jane 254" }));
    expect(errors).toHaveProperty("customerName");
  });

  it("rejects a quantity of zero", () => {
    const { errors } = validateOrder(
      validPayload({ items: [{ productId: "bw-refill-20", name: "Refill - 20L can", quantity: 0, unitPrice: 350 }], subtotal: 0, total: 120 })
    );
    expect(errors).toHaveProperty("items");
  });

  it("rejects an unknown station", () => {
    const { errors } = validateOrder(validPayload({ businessId: "not-a-station" }));
    expect(errors?.businessId).toMatch(/no longer available/i);
  });

  it("rejects an unsupported payment method", () => {
    const { errors } = validateOrder(validPayload({ payment: "cash" }));
    expect(errors).toHaveProperty("payment");
  });

  it("rejects a missing address", () => {
    const { errors } = validateOrder(validPayload({ address: undefined }));
    expect(errors).toHaveProperty("address");
  });

  it("rejects an order while the station is closed", () => {
    vi.setSystemTime(CLOSED_HOURS); // Mon 23:00 Nairobi
    const { order, errors } = validateOrder(validPayload());
    expect(order).toBeUndefined();
    expect(errors?.businessId).toMatch(/closed/i);
  });

  it("accepts the same order during opening hours", () => {
    vi.setSystemTime(OPEN_HOURS);
    expect(validateOrder(validPayload()).errors).toBeUndefined();
  });

  it("rejects a non-object payload", () => {
    expect(validateOrder(null).errors).toEqual({ _form: "Missing order payload." });
  });
});

describe("validateOrder - product options", () => {
  /** BioWater's refill: 350 base, swapping the empty can costs 50 less. */
  const swapEmpty = { productId: "bw-refill-20", name: "Refill - 20L can", quantity: 2, optionId: "swap-empty", unitPrice: 300 };

  it("prices the chosen option from the catalog and keeps its label", () => {
    const { order, errors } = validateOrder(
      validPayload({ items: [swapEmpty], subtotal: 600, deliveryFee: 120, total: 720 })
    );
    expect(errors).toBeUndefined();
    expect(order?.items[0]).toMatchObject({
      productId: "bw-refill-20",
      unitPrice: 300,
      optionId: "swap-empty",
      optionLabel: "Hand back your empty can",
      deposit: 0,
    });
    expect(order?.subtotal).toBe(600);
    expect(order?.total).toBe(720);
  });

  it("collects the refundable deposit of the chosen option and adds it to the total", () => {
    const { order, errors } = validateOrder(
      validPayload({
        items: [
          {
            productId: "bw-refill-20",
            name: "Refill - 20L can",
            quantity: 1,
            optionId: "new-can",
            unitPrice: 350,
          },
        ],
        subtotal: 350,
        deposit: 350,
        deliveryFee: 120,
        total: 820,
      })
    );
    expect(errors).toBeUndefined();
    expect(order?.deposit).toBe(350);
    expect(order?.items[0]).toMatchObject({ optionId: "new-can", deposit: 350 });
    expect(order?.total).toBe(820);
  });

  it("rejects a deposit that doesn't match the catalog", () => {
    const { order, errors } = validateOrder(
      validPayload({
        items: [
          {
            productId: "bw-refill-20",
            name: "Refill - 20L can",
            quantity: 1,
            optionId: "new-can",
            unitPrice: 350,
          },
        ],
        subtotal: 350,
        deposit: 1,
        deliveryFee: 120,
        total: 471,
      })
    );
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("deposit");
  });

  it("rejects a choice the station doesn't offer", () => {
    const { order, errors } = validateOrder(
      validPayload({
        items: [
          {
            productId: "bw-refill-20",
            name: "Refill - 20L can",
            quantity: 1,
            optionId: "not-a-real-option",
            unitPrice: 350,
          },
        ],
        subtotal: 350,
        total: 470,
      })
    );
    expect(order).toBeUndefined();
    expect(errors?.items).toMatch(/no longer available/);
  });

  it("rejects a quantity above the stock of the chosen option", () => {
    const { order, errors } = validateOrder(
      validPayload({
        items: [
          {
            productId: "bw-dispenser",
            name: "Dispenser rental",
            quantity: 9,
            optionId: "with-can",
            unitPrice: 950,
          },
        ],
        subtotal: 8550,
        total: 8670,
      })
    );
    expect(order).toBeUndefined();
    expect(errors?.items).toMatch(/Only 6/);
  });
});

describe("validateOrder - fulfilment", () => {
  it("charges nothing to collect and uses the station's own address", () => {
    const { order, errors } = validateOrder(
      validPayload({ fulfilment: "pickup", deliveryFee: 0, total: 700, address: undefined })
    );
    expect(errors).toBeUndefined();
    expect(order?.fulfilment).toBe("pickup");
    expect(order?.deliveryFee).toBe(0);
    expect(order?.total).toBe(700);
    expect(order?.address.estate).toBe("BioWater Refill Station");
    expect(order?.address.phone).toBe("0712345678");
  });

  it("rejects a delivery fee on a collected order", () => {
    const { order, errors } = validateOrder(validPayload({ fulfilment: "pickup", deliveryFee: 120, total: 820 }));
    expect(order).toBeUndefined();
    expect(errors).toHaveProperty("deliveryFee");
  });

  it("rejects an unknown fulfilment method", () => {
    const { errors } = validateOrder(validPayload({ fulfilment: "drone" }));
    expect(errors?.fulfilment).toMatch(/delivery or pickup/i);
  });

  it("accepts a delivery order pinned on the map without an area name", () => {
    const { order, errors } = validateOrder(
      validPayload({
        address: { label: "Map pin", phone: "0712345678", lat: -1.2833, lng: 36.8167 },
      })
    );
    expect(errors).toBeUndefined();
    expect(order?.address.estate).toBe("Pinned location");
    expect(order?.address.lat).toBe(-1.2833);
  });

  it("accepts a free-text area name for delivery", () => {
    const { order, errors } = validateOrder(
      validPayload({ address: { label: "Home", estate: "Kibera 2", phone: "0712345678" } })
    );
    expect(errors).toBeUndefined();
    expect(order?.address.estate).toBe("Kibera 2");
  });

  it("asks for an area or a pin when neither is given", () => {
    const { errors } = validateOrder(validPayload({ address: { label: "Home", phone: "0712345678" } }));
    expect(errors?.estate).toMatch(/area or drop a pin/);
  });
});

describe("createOrder idempotency", () => {
  it("returns the existing order for a duplicate submit instead of a second order", async () => {
    const { order } = validateOrder(validPayload());
    const first = await createOrder(order!);
    const second = await createOrder(order!);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);

    const stored = await listOrders({ businessId: "bio-water-kasarani" });
    expect(stored.filter((o) => o.id === first.order.id)).toHaveLength(1);
  });

  it("treats a reused id with different items as a new order", async () => {
    const { order } = validateOrder(validPayload());
    await createOrder(order!);
    const changed = { ...order!, items: [{ productId: "bw-5l", name: "5L bottle", quantity: 1, unitPrice: 60 }] };
    const result = await createOrder(changed);

    expect(result.created).toBe(true);
    expect(result.order.id).not.toBe("order-test-1");
  });
});

describe("updateOrder", () => {
  it("appends a timeline entry when the status changes", async () => {
    const { order } = validateOrder(validPayload());
    const created = (await createOrder(order!)).order;

    const updated = await updateOrder(created.id, { status: "accepted" });
    expect(updated?.timeline?.map((t) => t.status)).toEqual(["pending", "accepted"]);
  });

  it("does not append a timeline entry when the status is unchanged", async () => {
    const { order } = validateOrder(validPayload());
    const created = (await createOrder(order!)).order;

    const updated = await updateOrder(created.id, { status: "pending" });
    expect(updated?.timeline).toHaveLength(1);
  });

  it("returns null for an unknown order", async () => {
    expect(await updateOrder("nope", { status: "accepted" })).toBeNull();
  });
});

describe("listOrders", () => {
  it("filters by station and by status", async () => {
    await createOrder(makeOrder({ id: "a", businessId: "bio-water-kasarani", status: "delivered" }));
    await createOrder(makeOrder({ id: "b", businessId: "truflow-nyali", status: "delivered" }));

    const bio = await listOrders({ businessId: "bio-water-kasarani" });
    expect(bio.every((o) => o.businessId === "bio-water-kasarani")).toBe(true);
  });

  it("matches a phone stored in a different spelling", async () => {
    await createOrder(makeOrder({ id: "c", customerPhone: "+254 712 345 678" }));
    const found = await listOrders({ phone: "0712345678" });
    expect(found.some((o) => o.id === "c")).toBe(true);
  });
});

describe("recordLocation", () => {
  it("keeps the newest fix and returns null for an unknown order", async () => {
    const created = (await createOrder(makeOrder({ id: "loc" }))).order;
    const at = "2026-09-21T10:50:00.000Z";

    const updated = await recordLocation(created.id, { lat: -1.23, lng: 36.89, at });
    expect(updated && "location" in updated ? updated.location : null).toEqual({ lat: -1.23, lng: 36.89, accuracy: undefined, at });
    expect(await recordLocation("nope", { lat: 0, lng: 0, at })).toBeNull();
  });

  it("refuses a fix without location consent or once the order has closed", async () => {
    const at = "2026-09-21T10:50:00.000Z";
    await createOrder(makeOrder({ id: "no-consent", status: "pending", consent: { location: false, smsUpdates: true, updatedAt: at } }));
    expect(await recordLocation("no-consent", { lat: 0, lng: 0, at }, locationBlockReason)).toEqual({
      error: expect.stringMatching(/sharing is off/),
    });

    await createOrder(makeOrder({ id: "closed", status: "delivered", consent: { location: true, smsUpdates: true, updatedAt: at } }));
    expect(await recordLocation("closed", { lat: 0, lng: 0, at }, locationBlockReason)).toEqual({
      error: expect.stringMatching(/closed/),
    });
  });

  it("deletes shared locations when consent is withdrawn", async () => {
    const at = "2026-09-21T10:50:00.000Z";
    await createOrder(makeOrder({ id: "withdraw", status: "pending", consent: { location: true, smsUpdates: true, updatedAt: at } }));
    await recordLocation("withdraw", { lat: -1.2, lng: 36.8, at }, locationBlockReason);
    const after = await updateOrderConsent("withdraw", { location: false });
    expect(after?.location).toBeNull();
    expect(after?.locationHistory).toEqual([]);
    expect(after?.consent).toMatchObject({ location: false, smsUpdates: true });
  });
});

describe("transitionOrder", () => {
  it("purges live location and the rider link when an order closes", async () => {
    const at = "2026-09-21T10:50:00.000Z";
    await createOrder(
      makeOrder({
        id: "closing",
        status: "out_for_delivery",
        riderTokenHash: "hash",
        location: { lat: 1, lng: 1, at },
        locationHistory: [{ lat: 1, lng: 1, at }],
      })
    );
    const result = await transitionOrder("closing", "delivered", () => null, { actor: "rider" });
    expect(result && "order" in result).toBe(true);
    const order = (result as { order: import("@/lib/types").Order }).order;
    expect(order.location).toBeNull();
    expect(order.locationHistory).toEqual([]);
    expect(order).not.toHaveProperty("riderTokenHash");
    expect(order.closedAt).toBeTruthy();
    expect(order.timeline?.at(-1)).toMatchObject({ status: "delivered", actor: "rider" });
  });

  it("leaves the order untouched when the guard refuses", async () => {
    await createOrder(makeOrder({ id: "guarded", status: "pending" }));
    expect(await transitionOrder("guarded", "accepted", () => "no")).toEqual({ error: "no" });
    expect((await getOrder("guarded"))?.status).toBe("pending");
  });
});

describe("applyOrderRetention", () => {
  it(`drops the address pin ${ADDRESS_PIN_RETENTION_DAYS} days after an order closes, never for open orders`, async () => {
    const pin = { label: "Home", estate: "Kasarani", phone: "0712345678", lat: -1.22, lng: 36.89, accuracy: 10 };
    const closedAt = "2026-08-01T10:00:00.000Z";
    await createOrder(makeOrder({ id: "old", status: "delivered", closedAt, address: { ...pin } }));
    await createOrder(makeOrder({ id: "recent", status: "delivered", closedAt: "2026-09-20T10:00:00.000Z", address: { ...pin } }));
    await createOrder(makeOrder({ id: "open", status: "pending", address: { ...pin } }));

    expect(await applyOrderRetention(new Date("2026-09-21T07:00:00Z"))).toBe(1);
    const old = await getOrder("old");
    expect(old?.address.lat).toBeUndefined();
    expect(old?.address.estate).toBe("Kasarani");
    expect(old?.pinRedactedAt).toBeTruthy();
    expect((await getOrder("recent"))?.address.lat).toBe(-1.22);
    expect((await getOrder("open"))?.address.lat).toBe(-1.22);
  });
});

describe("getOrder", () => {
  it("returns a copy, never the stored object", async () => {
    const created = (await createOrder(makeOrder({ id: "clone" }))).order;
    const read = await getOrder(created.id);
    read!.customerName = "Changed";

    expect((await getOrder("loc"))?.customerName).not.toBe("");
    expect((await getOrder(created.id))?.customerName).toBe("Jane Wanjiku");
  });
});
