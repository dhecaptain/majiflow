import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeOrder } from "@/lib/testing/factories";

/**
 * The Postgres backend against a real database. Runs only when
 * MF_TEST_DATABASE_URL points at a throwaway, migrated database, e.g.
 *
 *   docker run -d --rm -e POSTGRES_PASSWORD=test -p 55433:5432 postgres:16-alpine
 *   DATABASE_URL=postgresql://postgres:test@localhost:55433/postgres?sslmode=disable pnpm db:migrate
 *   MF_TEST_DATABASE_URL=postgresql://postgres:test@localhost:55433/postgres?sslmode=disable pnpm test
 *
 * Every table it touches is emptied first, so never point it at real data.
 */
const url = process.env.MF_TEST_DATABASE_URL;

describe.skipIf(!url)("document store on Postgres", () => {
  let store: typeof import("@/lib/server/order-store");
  let payments: typeof import("@/lib/server/payments");
  let db: Awaited<ReturnType<typeof import("@/lib/server/db").getDatabase>>;

  beforeAll(async () => {
    delete process.env.MF_DATA_DIR;
    process.env.DATABASE_URL = url;
    store = await import("@/lib/server/order-store");
    payments = await import("@/lib/server/payments");
    db = await (await import("@/lib/server/db")).getDatabase();
  });

  beforeEach(async () => {
    await db.pool.query("TRUNCATE orders, payments");
  });

  afterAll(async () => {
    await db?.pool.end();
  });

  it("stores, finds and copies orders", async () => {
    const { order, created } = await store.createOrder(makeOrder({ id: "pg-1", idempotencyKey: "attempt-1" }));
    expect(created).toBe(true);
    expect(await store.getOrder(order.id)).toEqual(order);
    expect(await store.listOrders({ businessId: order.businessId })).toHaveLength(1);
    expect(await store.listOrders({ businessIds: ["bio-water-kasarani", "truflow-nyali"] })).toHaveLength(1);
    expect(await store.listOrders({ phone: "+254 712 345 678" })).toHaveLength(1);
    expect(await store.listOrders({ businessId: "someone-else" })).toEqual([]);
  });

  it("returns the existing order when a checkout attempt is retried", async () => {
    const first = await store.createOrder(makeOrder({ id: "pg-a", idempotencyKey: "attempt-2" }));
    const retry = await store.createOrder(makeOrder({ id: "pg-b", orderNumber: "MF-OTHER", idempotencyKey: "attempt-2" }));
    expect(retry.created).toBe(false);
    expect(retry.order.id).toBe(first.order.id);
  });

  it("keeps every concurrent write to one order", async () => {
    const at = "2026-09-21T10:50:00.000Z";
    const { order } = await store.createOrder(makeOrder({ id: "pg-loc" }));
    await Promise.all(
      Array.from({ length: 20 }, (_, i) => store.recordLocation(order.id, { lat: i, lng: i, at }))
    );
    expect((await store.getOrder(order.id))?.locationHistory).toHaveLength(20);
  });

  it("finds payments by order and refund", async () => {
    const { order } = await store.createOrder(makeOrder({ id: "pg-pay", status: "pending", paymentState: "pending" }));
    const { payment } = await payments.initiatePayment({
      orderIds: [order.id],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "pg-key",
    });
    const again = await payments.initiatePayment({
      orderIds: [order.id],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "pg-key",
    });
    expect(again.created).toBe(false);
    expect(again.payment.id).toBe(payment.id);

    await payments.applyProviderOutcome({ paymentId: payment.id, outcome: "success", amount: payment.amount });
    expect((await store.getOrder(order.id))?.paymentState).toBe("success");
    expect((await payments.findPaymentForOrder(order.id))?.id).toBe(payment.id);

    const refund = await payments.requestRefund({ paymentId: payment.id, reason: "Rejected", requestedBy: "test" });
    const confirmed = await payments.confirmRefund(refund.id, "REF-1");
    expect(confirmed?.status).toBe("confirmed");
    expect((await store.getOrder(order.id))?.paymentState).toBe("refunded");
  });
});
