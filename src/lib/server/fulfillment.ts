import { createHash, randomBytes } from "node:crypto";
import { notifyStatusChange, reportFailure } from "@/lib/monitoring";
import { needsRefund, STATUS_LABEL, transitionBlockReason } from "@/lib/order-status";
import { wantsOrderUpdates } from "@/lib/server/account";
import {
  findOrderByRiderToken,
  normalizePhone,
  setOrderRefund,
  transitionOrder,
} from "@/lib/server/order-store";
import { findPaymentForOrder, requestRefund } from "@/lib/server/payments";
import type { FulfillmentActor, Order, OrderStatus } from "@/lib/types";

/**
 * The order fulfilment service. Every status change - station, rider,
 * customer or admin - goes through `moveOrder`, which:
 *  1. checks access and the lifecycle rules inside one serialized write,
 *  2. records who made the move (and any customer-facing reason),
 *  3. hands paid rejections/cancellations to the refund flow, and
 *  4. sends the customer a status message when they have consented.
 */

const NOT_FOUND = "\u0000not-found";
const MAX_REASON = 200;

export type MoveResult =
  | { ok: true; order: Order }
  | { ok: false; status: 400 | 404 | 409; error: string };

export interface MoveRequest {
  orderId: string;
  to: OrderStatus;
  actor: FulfillmentActor;
  /** Access check against the stored order; failing it reads as "not found". */
  authorize: (order: Order) => boolean;
  /** Extra domain rule for this caller (e.g. the customer cancel window). */
  guard?: (order: Order) => string | null;
  reason?: string;
}

const DEFAULT_REASON: Partial<Record<OrderStatus, string>> = {
  rejected: "The station could not take this order.",
  cancelled: "The order was cancelled.",
};

export function cleanReason(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const text = input.trim().replace(/\s+/g, " ").slice(0, MAX_REASON);
  return text || undefined;
}

function closing(to: OrderStatus) {
  return to === "rejected" || to === "cancelled";
}

export async function moveOrder(request: MoveRequest): Promise<MoveResult> {
  const reason = closing(request.to) ? cleanReason(request.reason) ?? DEFAULT_REASON[request.to] : undefined;
  const result = await transitionOrder(
    request.orderId,
    request.to,
    (order) => {
      if (!request.authorize(order)) return NOT_FOUND;
      return request.guard?.(order) ?? transitionBlockReason(order, request.to, request.actor);
    },
    {
      actor: request.actor,
      note: reason,
      patch: (order) => {
        if (closing(request.to)) return { closedReason: reason };
        // Releasing a rider revokes their link and contact details.
        if (request.to === "preparing" && order.status === "rider_assigned") {
          return { rider: undefined, riderTokenHash: undefined };
        }
        return {};
      },
    }
  );
  if (!result || ("error" in result && result.error === NOT_FOUND)) {
    return { ok: false, status: 404, error: "Order not found" };
  }
  if ("error" in result) return { ok: false, status: 409, error: result.error };
  const order = await afterTransition(result.order, request.actor);
  return { ok: true, order };
}

/** Side effects of a committed move. Failures are reported, never undone. */
async function afterTransition(order: Order, actor: FulfillmentActor): Promise<Order> {
  let current = order;
  if (needsRefund(order)) current = await handOffRefund(order, actor);
  await notifyCustomer(current);
  return current;
}

async function handOffRefund(order: Order, actor: FulfillmentActor): Promise<Order> {
  const requestedAt = new Date().toISOString();
  try {
    const payment = await findPaymentForOrder(order.id);
    if (!payment) throw new Error("No confirmed payment is linked to this order.");
    const refund = await requestRefund({
      paymentId: payment.id,
      orderId: order.id,
      reason: `${STATUS_LABEL[order.status]} by ${actor}: ${order.closedReason ?? "no reason given"}`,
      requestedBy: actor,
    });
    return (
      (await setOrderRefund(order.id, {
        id: refund.id,
        status: refund.status,
        amount: refund.amount,
        requestedAt: refund.requestedAt,
        ...(refund.confirmedAt ? { confirmedAt: refund.confirmedAt } : {}),
      })) ?? order
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    await reportFailure("payment", "Could not open a refund for a closed paid order.", { orderId: order.id, reason });
    return (
      (await setOrderRefund(order.id, {
        id: "",
        status: "failed",
        amount: order.total,
        requestedAt,
        error: "We could not start the refund automatically - our support team will follow up.",
      })) ?? order
    );
  }
}

const CUSTOMER_MESSAGES: Partial<Record<OrderStatus, (order: Order) => string>> = {
  accepted: (o) => `${o.businessName} accepted order ${o.orderNumber}.`,
  rider_assigned: (o) => `${o.rider?.name ?? "A rider"} will deliver order ${o.orderNumber}.`,
  out_for_delivery: (o) => `Order ${o.orderNumber} is on the way.`,
  delivered: (o) => `Order ${o.orderNumber} was delivered. Thank you for using MajiFlow.`,
  rejected: (o) =>
    `${o.businessName} could not take order ${o.orderNumber}: ${o.closedReason ?? ""}${o.refund?.status === "pending" ? " Your refund has been started." : ""}`.trim(),
  cancelled: (o) =>
    `Order ${o.orderNumber} was cancelled: ${o.closedReason ?? ""}${o.refund?.status === "pending" ? " Your refund has been started." : ""}`.trim(),
};

/** Customer status message, sent only with consent for this order and on the account. */
async function notifyCustomer(order: Order) {
  const message = CUSTOMER_MESSAGES[order.status]?.(order);
  if (!message) return;
  if (order.consent && !order.consent.smsUpdates) return;
  if (!(await wantsOrderUpdates(order.customerUserId))) return;
  await notifyStatusChange({ id: order.id, status: order.status, orderNumber: order.orderNumber }, order.customerPhone, message);
}

/* ------------------------------------------------------------------ riders */

export function hashRiderToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface RiderInput {
  name: string;
  phone: string;
}

export function validateRider(input: unknown): { rider: RiderInput } | { errors: Record<string, string> } {
  const o = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const errors: Record<string, string> = {};
  const name = typeof o.name === "string" ? o.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 60 || !/^[\p{L}\p{M}'’.\- ]+$/u.test(name)) {
    errors.riderName = "Enter the rider's name (letters only).";
  }
  const phone = normalizePhone(o.phone);
  if (!phone) errors.riderPhone = "Enter the rider's Kenyan phone number.";
  if (Object.keys(errors).length) return { errors };
  return { rider: { name, phone: phone! } };
}

/**
 * Assign (or reassign) a rider. Issues a fresh single-order access token -
 * returned once, stored only as a hash - and revokes any earlier one.
 */
export async function assignRider(input: {
  orderId: string;
  rider: RiderInput;
  actor: FulfillmentActor;
  authorize: (order: Order) => boolean;
}): Promise<MoveResult & { token?: string }> {
  const token = randomBytes(24).toString("base64url");
  const rider = { ...input.rider, assignedAt: new Date().toISOString() };
  const firstName = rider.name.split(" ")[0];
  const result = await transitionOrder(
    input.orderId,
    "rider_assigned",
    (order) => {
      if (!input.authorize(order)) return NOT_FOUND;
      if (order.status === "rider_assigned") {
        return input.actor === "station" || input.actor === "admin" ? null : "You are not allowed to make this change.";
      }
      return transitionBlockReason({ ...order, rider }, "rider_assigned", input.actor);
    },
    {
      actor: input.actor,
      note: `Rider: ${firstName}`,
      patch: () => ({ rider, riderTokenHash: hashRiderToken(token) }),
    }
  );
  if (!result || ("error" in result && result.error === NOT_FOUND)) {
    return { ok: false, status: 404, error: "Order not found" };
  }
  if ("error" in result) return { ok: false, status: 409, error: result.error };
  await notifyCustomer(result.order);
  return { ok: true, order: result.order, token };
}

export type RiderAction = "pickup" | "deliver";

const RIDER_MOVES: Record<RiderAction, OrderStatus> = { pickup: "out_for_delivery", deliver: "delivered" };

export function isRiderAction(value: unknown): value is RiderAction {
  return value === "pickup" || value === "deliver";
}

/** What a rider sees: just enough to collect and deliver this one order. */
export interface RiderOrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  businessId: string;
  businessName: string;
  customerName: string;
  customerPhone: string;
  address: Order["address"];
  items: Order["items"];
  riderName: string;
  /** Amount to collect at the door: set only for an unpaid pay-on-delivery order. */
  collectAmount: number | null;
}

export function riderView(order: Order): RiderOrderView {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    businessId: order.businessId,
    businessName: order.businessName,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    address: order.address,
    items: order.items,
    riderName: order.rider?.name ?? "",
    collectAmount: order.payment === "cod" && order.paymentState === "pending" ? order.total : null,
  };
}

/** The order behind a live rider token, or null (unknown, revoked or closed). */
export async function orderForRider(token: string): Promise<Order | null> {
  if (typeof token !== "string" || token.length < 16 || token.length > 128) return null;
  return findOrderByRiderToken(hashRiderToken(token));
}

export async function riderMove(token: string, action: RiderAction): Promise<MoveResult> {
  const order = await orderForRider(token);
  if (!order) return { ok: false, status: 404, error: "This delivery link is no longer active." };
  const tokenHash = hashRiderToken(token);
  return moveOrder({
    orderId: order.id,
    to: RIDER_MOVES[action],
    actor: "rider",
    // Re-checked inside the write, so a reassignment revokes the old link at once.
    authorize: (current) => current.riderTokenHash === tokenHash,
  });
}
