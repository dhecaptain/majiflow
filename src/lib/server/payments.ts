import { promises as fs } from "node:fs";
import path from "node:path";
import type { Order, PaymentMethod, PaymentState } from "@/lib/types";
import { getOrder, setOrderRefund, updateOrder } from "@/lib/server/order-store";

/**
 * Server-side payment lifecycle (M-Pesa via Safaricom Daraja, card via the
 * same record flow).
 *
 * Boundaries:
 * - Orders are created `pending` and can only reach `success` through
 *   `applyProviderOutcome`, which runs on a verified provider callback,
 *   an explicit status reconciliation, or an authorized dev-test hook.
 * - The checkout UI never marks anything paid; it only polls `getPayment`.
 * - In `dev` mode (no Daraja credentials) payments wait for a test callback
 *   forever - nothing auto-succeeds. Dev callbacks are refused in production.
 * - Refunds are two-phase: `request` (pending) then `confirm` (only after the
 *   provider confirms). A refund is never displayed as complete before that.
 */

export type ProviderName = "daraja" | "dev";

export type PaymentRecordStatus = "pending" | "success" | "failed" | "cancelled" | "timeout";

export interface RefundRecord {
  id: string;
  paymentId: string;
  orderIds: string[];
  amount: number;
  reason: string;
  /** Pending until the provider confirms; only then may UI show it complete. */
  status: "pending" | "confirmed" | "failed";
  requestedBy: string;
  requestedAt: string;
  confirmedAt?: string;
  providerReference?: string;
}

export interface PaymentRecord {
  id: string;
  orderIds: string[];
  phone: string;
  method: PaymentMethod;
  /** Authoritative payable amount: the sum of the linked orders' server totals. */
  amount: number;
  status: PaymentRecordStatus;
  provider: ProviderName;
  idempotencyKey: string;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  providerReceipt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  /** Auditable trail of every outcome applied, including duplicates seen. */
  events: { at: string; kind: string; detail?: string }[];
  refunds: RefundRecord[];
}

export const PAYMENT_TIMEOUT_MS = 15 * 60 * 1000;

function dataDir(): string {
  return process.env.MF_DATA_DIR
    ? path.resolve(process.env.MF_DATA_DIR)
    : path.join(process.cwd(), ".data");
}

function paymentsFile(): string {
  return path.join(dataDir(), "payments.json");
}

let queue: Promise<unknown> = Promise.resolve();

async function readAll(): Promise<Record<string, PaymentRecord>> {
  try {
    const raw = await fs.readFile(paymentsFile(), "utf8");
    return JSON.parse(raw) as Record<string, PaymentRecord>;
  } catch {
    return {};
  }
}

async function persist(records: Record<string, PaymentRecord>) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(paymentsFile(), JSON.stringify(records, null, 2), "utf8");
}

function mutate<T>(fn: (records: Record<string, PaymentRecord>) => T | Promise<T>): Promise<T> {
  const run = async () => {
    const records = await readAll();
    const result = await fn(records);
    await persist(records);
    return result;
  };
  const next = queue.then(run, run);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function event(record: PaymentRecord, kind: string, detail?: string) {
  record.events.push({ at: new Date().toISOString(), kind, detail });
  record.updatedAt = new Date().toISOString();
}

/** Which provider to use. Daraja only when credentials are configured. */
export function providerMode(): ProviderName {
  if (process.env.MF_PAYMENTS_MODE === "daraja" || process.env.MF_PAYMENTS_MODE === "dev") {
    return process.env.MF_PAYMENTS_MODE;
  }
  return process.env.DARAJA_CONSUMER_KEY && process.env.DARAJA_CONSUMER_SECRET ? "daraja" : "dev";
}

/** Dev/test callbacks are only honored outside production. */
export function devCallbacksAllowed(): boolean {
  return providerMode() === "dev" && process.env.NODE_ENV !== "production";
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export interface InitiateInput {
  orderIds: string[];
  phone: string;
  method: PaymentMethod;
  idempotencyKey: string;
}

export interface InitiateResult {
  payment: PaymentRecord;
  created: boolean;
  /** True when the UI may offer a dev-test confirmation hook. Never true in production. */
  testMode: boolean;
}

/**
 * Start (or rejoin) a payment for already-created pending orders. Idempotent
 * on `idempotencyKey`: retries return the same record instead of charging
 * twice. The amount always comes from the orders' server-side totals.
 */
export async function initiatePayment(input: InitiateInput): Promise<InitiateResult> {
  const orderIds = [...new Set(input.orderIds.filter((id) => typeof id === "string" && id.trim()))];
  if (orderIds.length === 0) throw new Error("Select at least one order to pay for.");
  if (!input.idempotencyKey.trim()) throw new Error("Idempotency key is required.");
  if (input.method !== "mpesa" && input.method !== "card") throw new Error("Choose M-Pesa or card.");

  const orders: Order[] = [];
  for (const id of orderIds) {
    const order = await getOrder(id);
    if (!order) throw new Error("An order could not be found - it may have expired.");
    orders.push(order);
  }
  for (const order of orders) {
    if (order.paymentState !== "pending") {
      throw new Error(`Order ${order.orderNumber} is already ${order.paymentState} and cannot be paid again.`);
    }
    if (order.status !== "pending") {
      throw new Error(`Order ${order.orderNumber} is no longer payable.`);
    }
  }
  const amount = round2(orders.reduce((sum, o) => sum + o.total, 0));
  if (!(amount > 0)) throw new Error("Nothing to charge.");

  const mode = providerMode();

  const created = await mutate(async (records) => {
    const existing = Object.values(records).find((r) => r.idempotencyKey === input.idempotencyKey);
    if (existing) {
      event(existing, "initiate-duplicate", `Rejoined ${existing.id}`);
      return { payment: clone(existing), created: false };
    }
    const now = new Date().toISOString();
    const record: PaymentRecord = {
      id: newId("pay"),
      orderIds,
      phone: input.phone,
      method: input.method,
      amount,
      status: "pending",
      provider: mode,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
      events: [{ at: now, kind: "initiated", detail: `${input.method} for ${orderIds.length} order(s), ${amount}` }],
      refunds: [],
    };
    records[record.id] = record;
    return { payment: clone(record), created: true };
  });

  if (created.created && mode === "daraja") {
    try {
      const stk = await darajaStkPush({ phone: input.phone, amount, reference: created.payment.id });
      await mutate((records) => {
        const record = records[created.payment.id];
        if (!record) return;
        record.checkoutRequestId = stk.checkoutRequestId;
        record.merchantRequestId = stk.merchantRequestId;
        event(record, "stk-sent", stk.customerMessage ?? undefined);
      });
      created.payment = (await getPayment(created.payment.id)) ?? created.payment;
    } catch (error) {
      await mutate((records) => {
        const record = records[created.payment.id];
        if (!record) return;
        record.status = "failed";
        record.failureReason = error instanceof Error ? error.message : "STK push failed";
        event(record, "initiate-failed", record.failureReason);
      });
      created.payment = (await getPayment(created.payment.id)) ?? created.payment;
    }
  }

  return { ...created, testMode: devCallbacksAllowed() };
}

export type ProviderOutcome = "success" | "failed" | "cancelled" | "timeout";

/**
 * Apply a verified provider outcome. Idempotent: repeating the same receipt
 * or terminal outcome records an event but changes nothing twice. Amount
 * mismatches never flip an order to paid.
 */
export async function applyProviderOutcome(input: {
  paymentId?: string;
  checkoutRequestId?: string;
  outcome: ProviderOutcome;
  receipt?: string;
  amount?: number;
  detail?: string;
}): Promise<PaymentRecord | null> {
  return mutate(async (records) => {
    const record = input.paymentId
      ? records[input.paymentId]
      : Object.values(records).find((r) => r.checkoutRequestId && r.checkoutRequestId === input.checkoutRequestId);
    if (!record) return null;

    if (record.status !== "pending") {
      event(record, "callback-duplicate", `Ignored ${input.outcome}; already ${record.status}`);
      return clone(record);
    }

    if (input.outcome === "success") {
      if (typeof input.amount === "number" && Math.abs(input.amount - record.amount) > 0.01) {
        record.status = "failed";
        record.failureReason = `Paid ${input.amount} but ${record.amount} was due - flagged for review.`;
        event(record, "amount-mismatch", record.failureReason);
      } else {
        record.status = "success";
        if (input.receipt) record.providerReceipt = input.receipt;
        event(record, "succeeded", input.detail ?? input.receipt);
      }
    } else {
      record.status = input.outcome;
      record.failureReason = input.detail ?? `Provider reported ${input.outcome}.`;
      event(record, `marked-${input.outcome}`, record.failureReason);
    }

    // The order follows the verified payment - this is the ONLY path that
    // marks an order paid.
    const orderState: PaymentState =
      record.status === "success" ? "success" : record.status === "timeout" ? "timeout" : record.status === "cancelled" ? "cancelled" : "failed";
    for (const orderId of record.orderIds) {
      await updateOrder(orderId, { paymentState: orderState });
    }
    return clone(record);
  });
}

/** Read a payment, sweeping stale pending records to `timeout` first. */
export async function getPayment(id: string): Promise<PaymentRecord | null> {
  return mutate(async (records) => {
    const record = records[id];
    if (!record) return null;
    if (record.status === "pending" && Date.now() - Date.parse(record.createdAt) > PAYMENT_TIMEOUT_MS) {
      record.status = "timeout";
      record.failureReason = "No provider confirmation arrived in time.";
      event(record, "timed-out", record.failureReason);
      for (const orderId of record.orderIds) {
        await updateOrder(orderId, { paymentState: "timeout" });
      }
    }
    return clone(record);
  });
}

/** Reconcile a pending payment against the provider (Daraja query; dev returns the record). */
export async function reconcilePayment(id: string): Promise<PaymentRecord | null> {
  const record = await getPayment(id);
  if (!record || record.status !== "pending") return record;
  if (record.provider === "daraja" && record.checkoutRequestId) {
    try {
      const status = await darajaStkQuery(record.checkoutRequestId);
      if (status !== "pending") {
        return applyProviderOutcome({
          paymentId: id,
          outcome: status,
          detail: "Reconciled against Daraja transaction status.",
        });
      }
    } catch {
      /* keep pending - a failed query must never fail the payment */
    }
  }
  return record;
}

export interface RefundRequest {
  paymentId: string;
  reason: string;
  requestedBy: string;
  /**
   * Refund only this order's share of the payment (one checkout can pay
   * several stations). Without it the whole payment is refunded.
   */
  orderId?: string;
}

/** Open a refund. It stays `pending` until `confirmRefund` runs after provider confirmation. */
export async function requestRefund(input: RefundRequest): Promise<RefundRecord> {
  if (!input.reason.trim()) throw new Error("A refund reason is required.");
  const order = input.orderId ? await getOrder(input.orderId) : null;
  if (input.orderId && !order) throw new Error("Order not found.");
  return mutate(async (records) => {
    const record = records[input.paymentId];
    if (!record) throw new Error("Payment not found.");
    if (record.status !== "success") throw new Error("Only successful payments can be refunded.");
    const orderIds = order ? [order.id] : [...record.orderIds];
    if (order && !record.orderIds.includes(order.id)) throw new Error("That order was not paid by this payment.");
    const covers = (r: RefundRecord) => r.status !== "failed" && r.orderIds.some((id) => orderIds.includes(id));
    const existing = record.refunds.find(covers);
    if (existing) return clone(existing);
    const amount = order ? order.total : record.amount;
    const committed = record.refunds.filter((r) => r.status !== "failed").reduce((sum, r) => sum + r.amount, 0);
    if (committed + amount > record.amount + 0.01) throw new Error("Refunds would exceed the amount paid.");
    const refund: RefundRecord = {
      id: newId("ref"),
      paymentId: record.id,
      orderIds,
      amount,
      reason: input.reason.trim().slice(0, 500),
      status: "pending",
      requestedBy: input.requestedBy,
      requestedAt: new Date().toISOString(),
    };
    record.refunds.push(refund);
    event(record, "refund-requested", `${refund.id}: ${refund.reason}`);
    return clone(refund);
  });
}

/** The successful payment that covered an order, if any. */
export async function findPaymentForOrder(orderId: string): Promise<PaymentRecord | null> {
  return mutate((records) => {
    const record = Object.values(records).find((r) => r.status === "success" && r.orderIds.includes(orderId));
    return record ? clone(record) : null;
  });
}

/**
 * Confirm a refund after the provider confirms it. In Daraja mode this calls
 * the reversal API first; in dev mode confirmation is explicit and manual.
 * No order is ever shown as refunded before this runs.
 */
export async function confirmRefund(refundId: string, providerReference?: string): Promise<RefundRecord | null> {
  return mutate(async (records) => {
    const record = Object.values(records).find((r) => r.refunds.some((f) => f.id === refundId));
    const refund = record?.refunds.find((f) => f.id === refundId);
    if (!record || !refund) return null;
    if (refund.status !== "pending") return clone(refund);

    if (record.provider === "daraja" && !providerReference) {
      const result = await darajaReversal({
        amount: refund.amount,
        reference: refund.id,
        remarks: refund.reason,
      });
      refund.providerReference = result.reference;
    } else if (providerReference) {
      refund.providerReference = providerReference;
    } else if (record.provider === "daraja") {
      throw new Error("Provider confirmation missing.");
    }
    // Dev mode lands here only via an explicit, authorized confirm call.

    refund.status = "confirmed";
    refund.confirmedAt = new Date().toISOString();
    event(record, "refund-confirmed", `${refund.id}${refund.providerReference ? ` (${refund.providerReference})` : ""}`);
    for (const orderId of refund.orderIds) {
      await updateOrder(orderId, { paymentState: "refunded" });
      const order = await getOrder(orderId);
      if (order?.refund?.id === refund.id) {
        await setOrderRefund(orderId, { ...order.refund, status: "confirmed", confirmedAt: refund.confirmedAt });
      }
    }
    return clone(refund);
  });
}

// ---------------------------------------------------------------------------
// Daraja (Safaricom) HTTP boundary. All secrets stay server-side via env.
// ---------------------------------------------------------------------------

interface DarajaTokenResponse {
  access_token: string;
  expires_in: string;
}

let tokenCache: { token: string; expiresAt: number } | null = null;

function darajaBase(): string {
  return process.env.DARAJA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function requireDarajaEnv(): { key: string; secret: string; shortcode: string; passkey: string; callbackUrl: string } {
  const key = process.env.DARAJA_CONSUMER_KEY;
  const secret = process.env.DARAJA_CONSUMER_SECRET;
  const shortcode = process.env.DARAJA_SHORTCODE;
  const passkey = process.env.DARAJA_PASSKEY;
  const callbackUrl = process.env.DARAJA_CALLBACK_URL;
  if (!key || !secret || !shortcode || !passkey || !callbackUrl) {
    throw new Error("Daraja is not configured - set DARAJA_CONSUMER_KEY/SECRET/SHORTCODE/PASSKEY/CALLBACK_URL.");
  }
  return { key, secret, shortcode, passkey, callbackUrl };
}

async function darajaToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const { key, secret } = requireDarajaEnv();
  const res = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
  });
  if (!res.ok) throw new Error("Could not authenticate with Daraja.");
  const data = (await res.json()) as DarajaTokenResponse;
  tokenCache = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in) * 1000 };
  return data.access_token;
}

function stkPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

function timestampNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function darajaStkPush(input: { phone: string; amount: number; reference: string }): Promise<{
  checkoutRequestId: string;
  merchantRequestId: string;
  customerMessage?: string;
}> {
  const { shortcode, passkey, callbackUrl } = requireDarajaEnv();
  const token = await darajaToken();
  const timestamp = timestampNow();
  const digits = input.phone.replace(/\D/g, "");
  const partyA = digits.startsWith("254") ? digits : digits.startsWith("0") ? `254${digits.slice(1)}` : digits;
  const res = await fetch(`${darajaBase()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: stkPassword(shortcode, passkey, timestamp),
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(input.amount),
      PartyA: partyA,
      PartyB: shortcode,
      PhoneNumber: partyA,
      CallBackURL: callbackUrl,
      AccountReference: input.reference.slice(0, 20),
      TransactionDesc: `MajiFlow ${input.reference}`.slice(0, 20),
    }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || data.ResponseCode !== "0" || typeof data.CheckoutRequestID !== "string") {
    throw new Error(typeof data.errorMessage === "string" ? data.errorMessage : "STK push was rejected.");
  }
  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: typeof data.MerchantRequestID === "string" ? data.MerchantRequestID : "",
    customerMessage: typeof data.CustomerMessage === "string" ? data.CustomerMessage : undefined,
  };
}

async function darajaStkQuery(checkoutRequestId: string): Promise<ProviderOutcome | "pending"> {
  const { shortcode, passkey } = requireDarajaEnv();
  const token = await darajaToken();
  const timestamp = timestampNow();
  const res = await fetch(`${darajaBase()}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: stkPassword(shortcode, passkey, timestamp),
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error("Status query failed.");
  // ResultCode 0 = success; 1032 = cancelled by user; 1/1037/timeout codes = failed/timeout.
  if (data.ResultCode === "0") return "success";
  if (data.ResultCode === "1032") return "cancelled";
  if (typeof data.ResultDesc === "string" && /timeout|expired/i.test(data.ResultDesc)) return "timeout";
  if (data.ResultCode === "500.001.1001" || data.ResultCode === "2001") return "pending";
  return "failed";
}

async function darajaReversal(input: { amount: number; reference: string; remarks: string }): Promise<{ reference: string }> {
  const token = await darajaToken();
  const shortcode = process.env.DARAJA_SHORTCODE ?? "";
  const initiator = process.env.DARAJA_INITIATOR ?? "";
  const credential = process.env.DARAJA_SECURITY_CREDENTIAL ?? "";
  const queueTimeout = process.env.DARAJA_QUEUE_TIMEOUT_URL ?? process.env.DARAJA_CALLBACK_URL ?? "";
  const resultUrl = process.env.DARAJA_RESULT_URL ?? process.env.DARAJA_CALLBACK_URL ?? "";
  if (!shortcode || !initiator || !credential || !queueTimeout || !resultUrl) {
    throw new Error("Daraja reversal is not configured - set DARAJA_INITIATOR/SECURITY_CREDENTIAL/RESULT_URL.");
  }
  const res = await fetch(`${darajaBase()}/mpesa/reversal/v1/request`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      Initiator: initiator,
      SecurityCredential: credential,
      CommandID: "TransactionReversal",
      TransactionID: input.reference.slice(0, 20),
      Amount: Math.round(input.amount),
      ReceiverParty: shortcode,
      RecieverIdentifierType: "11",
      ResultURL: resultUrl,
      QueueTimeOutURL: queueTimeout,
      Remarks: input.remarks.slice(0, 20),
      Occasion: "MajiFlow refund",
    }),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(typeof data.errorMessage === "string" ? data.errorMessage : "Reversal was rejected.");
  }
  return { reference: typeof data.ConversationID === "string" ? data.ConversationID : input.reference };
}

/** Refund endpoints are server-to-server: callers must present the admin key. */
export function adminKeyOk(request: Request): boolean {
  const configured = process.env.MF_ADMIN_KEY;
  if (!configured) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${configured}`;
}

/** Parse a Daraja STK callback body into an outcome. Returns null when not a Daraja payload. */
export function parseDarajaCallback(body: unknown): {
  checkoutRequestId: string;
  outcome: ProviderOutcome;
  receipt?: string;
  amount?: number;
  detail?: string;
} | null {
  if (typeof body !== "object" || body === null) return null;
  const envelope = (body as Record<string, unknown>).Body as Record<string, unknown> | undefined;
  const cb = envelope?.stkCallback as Record<string, unknown> | undefined;
  if (!cb || typeof cb.CheckoutRequestID !== "string") return null;
  const code = cb.ResultCode;
  const meta = (cb.CallbackMetadata as Record<string, unknown> | undefined)?.Item as
    | { Name?: string; Value?: unknown }[]
    | undefined;
  const metaValue = (name: string): unknown => meta?.find((i) => i.Name === name)?.Value;
  const receipt = metaValue("MpesaReceiptNumber");
  const amount = metaValue("Amount");
  const detail = typeof cb.ResultDesc === "string" ? cb.ResultDesc : undefined;
  const outcome: ProviderOutcome =
    code === 0 || code === "0"
      ? "success"
      : code === 1032 || code === "1032"
        ? "cancelled"
        : /timeout|expired/i.test(detail ?? "")
          ? "timeout"
          : "failed";
  return {
    checkoutRequestId: cb.CheckoutRequestID,
    outcome,
    receipt: typeof receipt === "string" ? receipt : undefined,
    amount: typeof amount === "number" ? amount : undefined,
    detail,
  };
}
