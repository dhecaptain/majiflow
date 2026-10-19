import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrder, validateOrder } from "@/lib/server/order-store";
import {
  applyProviderOutcome,
  confirmRefund,
  getPayment,
  initiatePayment,
  parseDarajaCallback,
  requestRefund,
} from "@/lib/server/payments";

/**
 * Targeted coverage for the verified payment lifecycle: nothing is ever
 * marked paid without a provider outcome, callbacks are idempotent, stale
 * payments time out, and refunds stay pending until confirmed.
 */

let dataDir: string;

function orderPayload() {
  return {
    id: "pay-order-1",
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
  };
}

async function seedOrder(id = "pay-order-1") {
  const { order, errors } = validateOrder({ ...orderPayload(), id });
  expect(errors).toBeUndefined();
  await createOrder(order!);
  return order!;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T07:00:00Z")); // Mon 10:00 Nairobi, station open
  dataDir = await mkdtemp(path.join(tmpdir(), "mf-pay-"));
  process.env.MF_DATA_DIR = dataDir;
  delete process.env.MF_PAYMENTS_MODE;
});

afterEach(async () => {
  vi.useRealTimers();
  delete process.env.MF_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

describe("initiatePayment", () => {
  it("creates a pending payment for the orders' server totals and never auto-succeeds", async () => {
    await seedOrder();
    const { payment, created, testMode } = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-1",
    });
    expect(created).toBe(true);
    expect(payment.status).toBe("pending");
    expect(payment.amount).toBe(820);
    expect(testMode).toBe(true);
  });

  it("rejoins the same payment on a duplicate idempotency key instead of charging twice", async () => {
    await seedOrder();
    const first = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-dup",
    });
    const second = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-dup",
    });
    expect(second.created).toBe(false);
    expect(second.payment.id).toBe(first.payment.id);
  });

  it("refuses unknown orders", async () => {
    await expect(
      initiatePayment({ orderIds: ["nope"], phone: "0712345678", method: "mpesa", idempotencyKey: "k" })
    ).rejects.toThrow(/could not be found/i);
  });
});

describe("applyProviderOutcome", () => {
  it("marks the payment and its order paid on a verified success", async () => {
    await seedOrder();
    const { payment } = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-ok",
    });
    const updated = await applyProviderOutcome({
      paymentId: payment.id,
      outcome: "success",
      receipt: "RCPT-1",
      amount: 820,
    });
    expect(updated?.status).toBe("success");
    expect(updated?.providerReceipt).toBe("RCPT-1");
  });

  it("ignores a duplicate callback without changing anything twice", async () => {
    await seedOrder();
    const { payment } = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-twice",
    });
    await applyProviderOutcome({ paymentId: payment.id, outcome: "success", amount: 820 });
    const again = await applyProviderOutcome({ paymentId: payment.id, outcome: "success", amount: 820 });
    expect(again?.status).toBe("success");
    expect(again?.events.some((e) => e.kind === "callback-duplicate")).toBe(true);
  });

  it("fails instead of paying on an amount mismatch", async () => {
    await seedOrder();
    const { payment } = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-short",
    });
    const updated = await applyProviderOutcome({ paymentId: payment.id, outcome: "success", amount: 100 });
    expect(updated?.status).toBe("failed");
    expect(updated?.failureReason).toMatch(/flagged for review/i);
  });

  it("records cancellations without paying", async () => {
    await seedOrder();
    const { payment } = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-cancel",
    });
    const updated = await applyProviderOutcome({ paymentId: payment.id, outcome: "cancelled" });
    expect(updated?.status).toBe("cancelled");
  });
});

describe("getPayment timeout sweep", () => {
  it("times out a stale pending payment", async () => {
    await seedOrder();
    const { payment } = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-old",
    });
    const file = path.join(dataDir, "payments.json");
    const raw = JSON.parse(await readFile(file, "utf8")) as Record<string, { createdAt: string }>;
    raw[payment.id].createdAt = new Date(Date.parse("2026-09-21T07:00:00Z") - 20 * 60 * 1000).toISOString();
    await writeFile(file, JSON.stringify(raw), "utf8");

    const swept = await getPayment(payment.id);
    expect(swept?.status).toBe("timeout");
  });
});

describe("refund lifecycle", () => {
  it("stays pending on request and only completes on confirmation", async () => {
    await seedOrder();
    const { payment } = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-ref",
    });
    await applyProviderOutcome({ paymentId: payment.id, outcome: "success", amount: 820 });

    const refund = await requestRefund({ paymentId: payment.id, reason: "Station rejected the order", requestedBy: "admin" });
    expect(refund.status).toBe("pending");

    const reread = await getPayment(payment.id);
    expect(reread?.refunds[0].status).toBe("pending");

    const confirmed = await confirmRefund(refund.id, "DEV-REF-1");
    expect(confirmed?.status).toBe("confirmed");
    expect(confirmed?.providerReference).toBe("DEV-REF-1");
  });

  it("refuses refunds for unpaid payments", async () => {
    await seedOrder();
    const { payment } = await initiatePayment({
      orderIds: ["pay-order-1"],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "key-ref-no",
    });
    await expect(requestRefund({ paymentId: payment.id, reason: "x", requestedBy: "admin" })).rejects.toThrow(
      /only successful/i
    );
  });
});

describe("parseDarajaCallback", () => {
  const base = (code: number, desc: string, items: { Name: string; Value: unknown }[] = []) => ({
    Body: { stkCallback: { CheckoutRequestID: "CHK-1", ResultCode: code, ResultDesc: desc, CallbackMetadata: { Item: items } } },
  });

  it("maps a successful STK callback with receipt and amount", () => {
    const parsed = parseDarajaCallback(
      base(0, "Success", [
        { Name: "MpesaReceiptNumber", Value: "RCPT-9" },
        { Name: "Amount", Value: 820 },
      ])
    );
    expect(parsed).toMatchObject({ checkoutRequestId: "CHK-1", outcome: "success", receipt: "RCPT-9", amount: 820 });
  });

  it("maps user cancellation and timeout distinctly", () => {
    expect(parseDarajaCallback(base(1032, "Cancelled by user"))?.outcome).toBe("cancelled");
    expect(parseDarajaCallback(base(1, "Request timeout, try again"))?.outcome).toBe("timeout");
  });

  it("rejects non-Daraja payloads", () => {
    expect(parseDarajaCallback({ hello: 1 })).toBeNull();
  });
});
