import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOrder,
  getOrder,
  listOrders,
  recordLocation,
  updateOrder,
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
    expect(updated?.location).toEqual({ lat: -1.23, lng: 36.89, accuracy: undefined, at });
    expect(await recordLocation("nope", { lat: 0, lng: 0, at })).toBeNull();
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
