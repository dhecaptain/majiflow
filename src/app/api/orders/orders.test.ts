import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getOrderRoute, PATCH } from "@/app/api/orders/[id]/route";
import { GET as listRoute, POST } from "@/app/api/orders/route";

/**
 * The route handlers are called directly, so the whole request path is
 * exercised - JSON parsing, validation, the store, and the patch allow-list -
 * without needing a running server.
 */

let dataDir: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T07:00:00Z")); // Mon 10:00 Nairobi
  dataDir = await mkdtemp(path.join(tmpdir(), "mf-api-"));
  process.env.MF_DATA_DIR = dataDir;
});

afterEach(async () => {
  vi.useRealTimers();
  delete process.env.MF_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    id: "api-order-1",
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

function postRequest(body: unknown) {
  return new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function patchRequest(id: string, body: unknown) {
  return new Request(`http://localhost/api/orders/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const context = (id: string) => ({ params: Promise.resolve({ id }) });

async function createOrder(body: unknown = validBody()) {
  return POST(postRequest(body));
}

describe("POST /api/orders", () => {
  it("creates an order and answers 201", async () => {
    const response = await createOrder();
    expect(response.status).toBe(201);
    const { order } = await response.json();
    expect(order.id).toBe("api-order-1");
    expect(order.total).toBe(820);
  });

  it("treats a retry of the same order as a duplicate, not a second order", async () => {
    expect((await createOrder()).status).toBe(201);
    expect((await createOrder()).status).toBe(200);

    const listed = await (await listRoute(new NextRequest("http://localhost/api/orders"))).json();
    expect(listed.orders.filter((o: { id: string }) => o.id === "api-order-1")).toHaveLength(1);
  });

  it("answers 422 with field errors when the client total is wrong", async () => {
    const response = await createOrder(validBody({ total: 1 }));
    expect(response.status).toBe(422);
    expect((await response.json()).fields.total).toBeTruthy();
  });

  it("rejects a client-declared paid state", async () => {
    const response = await createOrder(validBody({ paymentState: "success" }));
    expect(response.status).toBe(422);
    expect((await response.json()).fields.paymentState).toBeTruthy();
  });

  it("rejects a manipulated unit price", async () => {
    const response = await createOrder(
      validBody({
        items: [{ productId: "bw-refill-20", name: "Refill - 20L can", quantity: 2, unitPrice: 1 }],
        subtotal: 2,
        total: 122,
      })
    );
    expect(response.status).toBe(422);
    expect((await response.json()).fields.items).toBeTruthy();
  });

  it("answers 400 on a malformed JSON body", async () => {
    expect((await POST(postRequest("{not json"))).status).toBe(400);
  });
});

describe("PATCH /api/orders/[id]", () => {
  it("moves an order through the vendor flow", async () => {
    await createOrder();
    const response = await PATCH(patchRequest("api-order-1", { status: "accepted" }), context("api-order-1"));
    expect(response.status).toBe(200);
    const { order } = await response.json();
    expect(order.status).toBe("accepted");
    expect(order.timeline.map((t: { status: string }) => t.status)).toEqual(["pending", "accepted"]);
  });

  it("refuses a patch that only tries to change money", async () => {
    await createOrder();
    const response = await PATCH(
      patchRequest("api-order-1", { total: 1, subtotal: 1, deliveryFee: 0, items: [] }),
      context("api-order-1")
    );
    expect(response.status).toBe(400);
  });

  it("applies allowed fields and ignores the rest", async () => {
    await createOrder();
    const response = await PATCH(
      patchRequest("api-order-1", { status: "accepted", total: 1 }),
      context("api-order-1")
    );
    const { order } = await response.json();
    expect(order.status).toBe("accepted");
    expect(order.total).toBe(820);
  });

  it("rejects an unknown status", async () => {
    await createOrder();
    expect(
      (await PATCH(patchRequest("api-order-1", { status: "teleported" }), context("api-order-1"))).status
    ).toBe(400);
  });

  it("rejects an unknown payment state", async () => {
    await createOrder();
    expect(
      (await PATCH(patchRequest("api-order-1", { paymentState: "refunded" }), context("api-order-1"))).status
    ).toBe(400);
  });

  it("refuses every client payment-state transition - payment is server-managed", async () => {
    await createOrder();
    for (const paymentState of ["pending", "failed", "success"]) {
      const response = await PATCH(patchRequest("api-order-1", { paymentState }), context("api-order-1"));
      expect(response.status).toBe(400);
    }
    const stored = await (await listRoute(new NextRequest("http://localhost/api/orders"))).json();
    expect(stored.orders[0].paymentState).toBe("pending");
  });

  it("answers 404 for an unknown order", async () => {
    expect((await PATCH(patchRequest("nope", { status: "accepted" }), context("nope"))).status).toBe(404);
  });
});

describe("GET /api/orders/[id]", () => {
  it("returns the order", async () => {
    await createOrder();
    const response = await getOrderRoute(new Request("http://localhost/api/orders/api-order-1"), context("api-order-1"));
    expect((await response.json()).order.id).toBe("api-order-1");
  });

  it("answers 404 for an unknown order", async () => {
    expect((await getOrderRoute(new Request("http://localhost/api/orders/nope"), context("nope"))).status).toBe(404);
  });
});
