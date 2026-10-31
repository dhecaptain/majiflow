import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOrder, getOrder, transitionOrder, updateOrder, validateOrder } from "@/lib/server/order-store";
import {
  applyDarajaCallback,
  applyReversalResult,
  callbackTokenOk,
  confirmRefund,
  initiatePayment,
  requestRefund,
} from "@/lib/server/payments";
import { transitionBlockReason } from "@/lib/order-status";
import { cancelBlockReason } from "@/lib/account";

/**
 * Pay on delivery and the hardened M-Pesa path: nothing is marked paid on an
 * unverified callback, STK prompts only go to the order's phone, and a refund
 * is only complete once the reversal result arrives.
 */

let dataDir: string;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    id: "attempt-1",
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

async function place(overrides: Record<string, unknown> = {}) {
  const { order, errors } = validateOrder(payload(overrides));
  expect(errors).toBeUndefined();
  return (await createOrder(order!)).order;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T07:00:00Z"));
  dataDir = await mkdtemp(path.join(tmpdir(), "mf-hard-"));
  process.env.MF_DATA_DIR = dataDir;
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  delete process.env.MF_DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

describe("payment methods at checkout", () => {
  it("accepts pay on delivery and refuses card", () => {
    expect(validateOrder(payload({ payment: "cod" })).errors).toBeUndefined();
    expect(validateOrder(payload({ payment: "card" })).errors?.payment).toBeTruthy();
  });

  it("refuses M-Pesa up front in production without a live provider", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MF_PAYMENTS_MODE", "dev");
    expect(validateOrder(payload()).errors?.payment).toMatch(/pay on delivery/);
    expect(validateOrder(payload({ payment: "cod" })).errors).toBeUndefined();
  });
});

describe("pay on delivery", () => {
  it("can be accepted unpaid and is marked paid when delivered", async () => {
    const order = await place({ payment: "cod" });
    expect(transitionBlockReason(order, "accepted", "station")).toBeNull();
    for (const status of ["accepted", "preparing"] as const) {
      await transitionOrder(order.id, status, () => null, { actor: "station" });
    }
    await updateOrder(order.id, { rider: { name: "Otieno", phone: "0700000000", assignedAt: new Date().toISOString() } });
    for (const status of ["rider_assigned", "out_for_delivery", "delivered"] as const) {
      await transitionOrder(order.id, status, () => null, { actor: "rider" });
    }
    expect((await getOrder(order.id))?.paymentState).toBe("success");
  });

  it("keeps a prepaid M-Pesa order waiting for payment before acceptance", async () => {
    const order = await place();
    expect(transitionBlockReason(order, "accepted", "station")).toMatch(/Payment has not been confirmed/);
  });

  it("lets the customer cancel a pending order straight away", async () => {
    const order = await place({ payment: "cod" });
    expect(cancelBlockReason(order)).toBeNull();
  });

  it("never opens an online payment for it", async () => {
    const order = await place({ payment: "cod" });
    await expect(
      initiatePayment({ orderIds: [order.id], phone: "0712345678", method: "mpesa", idempotencyKey: "k1" })
    ).rejects.toThrow(/paid on delivery/);
  });
});

describe("M-Pesa prompts", () => {
  it("only go to a phone on the order", async () => {
    const order = await place();
    await expect(
      initiatePayment({ orderIds: [order.id], phone: "0799999999", method: "mpesa", idempotencyKey: "k2" })
    ).rejects.toThrow(/phone number on the order/);
    const { payment } = await initiatePayment({
      orderIds: [order.id],
      phone: "+254 712 345 678",
      method: "mpesa",
      idempotencyKey: "k3",
    });
    expect(payment.phone).toBe("0712345678");
  });
});

describe("Daraja callbacks", () => {
  it("need the secret token", () => {
    const at = (url: string) => new Request(url, { method: "POST" });
    expect(callbackTokenOk(at("https://x/api/payments/callback?token=s3cret"))).toBe(false);
    vi.stubEnv("MF_PAYMENTS_CALLBACK_TOKEN", "s3cret");
    expect(callbackTokenOk(at("https://x/api/payments/callback?token=s3cret"))).toBe(true);
    expect(callbackTokenOk(at("https://x/api/payments/callback?token=nope"))).toBe(false);
    expect(callbackTokenOk(at("https://x/api/payments/callback"))).toBe(false);
  });

  async function pendingDarajaPayment() {
    const order = await place();
    const { payment } = await initiatePayment({
      orderIds: [order.id],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "k-daraja",
    });
    // Stand in for the STK push response, which carries the checkout request id.
    await updateCheckoutRequest(payment.id, "ws_CO_1");
    return { order, payment };
  }

  async function updateCheckoutRequest(paymentId: string, checkoutRequestId: string) {
    const fs = await import("node:fs/promises");
    const file = path.join(dataDir, "payments.json");
    const records = JSON.parse(await fs.readFile(file, "utf8"));
    records[paymentId].checkoutRequestId = checkoutRequestId;
    await fs.writeFile(file, JSON.stringify(records));
  }

  it("do not mark anything paid without an amount", async () => {
    const { order } = await pendingDarajaPayment();
    const payment = await applyDarajaCallback({ checkoutRequestId: "ws_CO_1", outcome: "success" }, async () => "success");
    expect(payment?.status).toBe("pending");
    expect((await getOrder(order.id))?.paymentState).toBe("pending");
  });

  it("do not mark anything paid unless Daraja confirms it", async () => {
    const { order } = await pendingDarajaPayment();
    const payment = await applyDarajaCallback(
      { checkoutRequestId: "ws_CO_1", outcome: "success", amount: 820, receipt: "R1" },
      async () => "pending"
    );
    expect(payment?.status).toBe("pending");
    expect((await getOrder(order.id))?.paymentState).toBe("pending");
  });

  it("mark the order paid once the amount matches and Daraja confirms", async () => {
    const { order } = await pendingDarajaPayment();
    const payment = await applyDarajaCallback(
      { checkoutRequestId: "ws_CO_1", outcome: "success", amount: 820, receipt: "R1" },
      async () => "success"
    );
    expect(payment?.status).toBe("success");
    expect((await getOrder(order.id))?.paymentState).toBe("success");
  });
});

describe("refunds through Daraja", () => {
  it("stay pending until the reversal result confirms them", async () => {
    vi.stubEnv("MF_PAYMENTS_MODE", "daraja");
    const order = await place();
    const { payment } = await initiatePayment({
      orderIds: [order.id],
      phone: "0712345678",
      method: "mpesa",
      idempotencyKey: "k-refund",
    }).catch(() => ({ payment: null }));
    // Without credentials the STK push fails; settle the record the way a
    // verified callback would so the refund path can be exercised.
    expect(payment).not.toBeNull();
    const fs = await import("node:fs/promises");
    const file = path.join(dataDir, "payments.json");
    const records = JSON.parse(await fs.readFile(file, "utf8"));
    Object.assign(records[payment!.id], { status: "success", failureReason: undefined });
    await fs.writeFile(file, JSON.stringify(records));
    await updateOrder(order.id, { paymentState: "success" });

    const refund = await requestRefund({ paymentId: payment!.id, reason: "Rejected", requestedBy: "station" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("oauth")) return Response.json({ access_token: "t", expires_in: "3600" });
      return Response.json({ ResponseCode: "0", ConversationID: "AG_1" });
    });
    vi.stubEnv("DARAJA_CONSUMER_KEY", "k");
    vi.stubEnv("DARAJA_CONSUMER_SECRET", "s");
    vi.stubEnv("DARAJA_SHORTCODE", "174379");
    vi.stubEnv("DARAJA_PASSKEY", "p");
    vi.stubEnv("DARAJA_CALLBACK_URL", "https://x/cb");
    vi.stubEnv("DARAJA_INITIATOR", "api");
    vi.stubEnv("DARAJA_SECURITY_CREDENTIAL", "c");
    vi.stubEnv("DARAJA_RESULT_URL", "https://x/result");

    const requested = await confirmRefund(refund.id);
    fetchMock.mockRestore();
    expect(requested?.status).toBe("pending");
    expect(requested?.providerReference).toBe("AG_1");
    expect((await getOrder(order.id))?.paymentState).toBe("success");

    const settled = await applyReversalResult({ conversationId: "AG_1", success: true });
    expect(settled?.status).toBe("confirmed");
    expect((await getOrder(order.id))?.paymentState).toBe("refunded");
  });
});
