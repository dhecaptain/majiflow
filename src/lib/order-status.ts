import type { FulfillmentActor, Order, OrderStatus } from "@/lib/types";

/**
 * The order lifecycle, shared by the server (which enforces it) and the
 * screens (which only offer moves the server will accept).
 *
 *   pending ─▶ accepted ─▶ preparing ─▶ rider_assigned ─▶ out_for_delivery ─▶ delivered
 *      │           │            │               │                  │
 *      ├▶ rejected └────────────┴─▶ cancelled ◀─┴──────────────────┘
 *      └▶ cancelled (customer, before payment lands)
 *
 * `pending` means the order exists; the station may accept it only once the
 * payment provider has confirmed payment. Rejecting or cancelling a paid
 * order hands a refund off to the payments service.
 */

export const FULFILLMENT_FLOW: readonly OrderStatus[] = [
  "pending",
  "accepted",
  "preparing",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ["delivered", "rejected", "cancelled"];

const STATUSES: readonly OrderStatus[] = [...FULFILLMENT_FLOW, "rejected", "cancelled"];

export const ACTIVE_STATUSES: readonly OrderStatus[] = FULFILLMENT_FLOW.filter(
  (status) => status !== "delivered"
);

type Transitions = Record<OrderStatus, Partial<Record<OrderStatus, readonly FulfillmentActor[]>>>;

const STAFF: readonly FulfillmentActor[] = ["station", "admin"];

/** Allowed moves, and who may make each one. Anything not listed is refused. */
export const TRANSITIONS: Transitions = {
  pending: { accepted: STAFF, rejected: STAFF, cancelled: ["customer", "admin"] },
  accepted: { preparing: STAFF, cancelled: STAFF },
  preparing: { rider_assigned: STAFF, cancelled: STAFF },
  // Back to `preparing` releases a rider who cannot make the run.
  rider_assigned: { out_for_delivery: ["station", "rider", "admin"], preparing: STAFF, cancelled: STAFF },
  out_for_delivery: { delivered: ["station", "rider", "admin"], cancelled: STAFF },
  delivered: {},
  rejected: {},
  cancelled: {},
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  rider_assigned: "Rider assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (STATUSES as readonly string[]).includes(v);
}

export function isActiveStatus(status: OrderStatus) {
  return ACTIVE_STATUSES.includes(status);
}

export function isTerminalStatus(status: OrderStatus) {
  return TERMINAL_STATUSES.includes(status);
}

/** Moves out of `from` that `actor` may make. */
export function allowedTransitions(from: OrderStatus, actor: FulfillmentActor): OrderStatus[] {
  return (Object.entries(TRANSITIONS[from]) as [OrderStatus, readonly FulfillmentActor[]][])
    .filter(([, actors]) => actors.includes(actor))
    .map(([to]) => to);
}

/**
 * Why `actor` may not move `order` to `to`, or null when the move is allowed.
 * Messages are written for the person who tried the move.
 */
export function transitionBlockReason(order: Order, to: OrderStatus, actor: FulfillmentActor): string | null {
  if (order.status === to) return `This order is already ${STATUS_LABEL[to].toLowerCase()}.`;
  const actors = TRANSITIONS[order.status][to];
  if (!actors) {
    if (isTerminalStatus(order.status)) return `This order is ${STATUS_LABEL[order.status].toLowerCase()} and can no longer change.`;
    return `An order that is ${STATUS_LABEL[order.status].toLowerCase()} cannot move to ${STATUS_LABEL[to].toLowerCase()}.`;
  }
  if (!actors.includes(actor)) return "You are not allowed to make this change.";
  if (to === "accepted" && order.paymentState !== "success") {
    return "Payment has not been confirmed yet - accept the order once M-Pesa confirms it.";
  }
  if (to === "rider_assigned" && !order.rider) return "Assign a rider with a name and phone number first.";
  return null;
}

/** The single forward step staff take next, or null when nothing is waiting on the station. */
export function nextStationStep(order: Order): OrderStatus | null {
  const index = FULFILLMENT_FLOW.indexOf(order.status);
  if (index < 0 || index >= FULFILLMENT_FLOW.length - 1) return null;
  return FULFILLMENT_FLOW[index + 1];
}

/** Whether a paid order needs its money returned when it closes without delivery. */
export function needsRefund(order: Pick<Order, "paymentState" | "status">) {
  return order.paymentState === "success" && (order.status === "rejected" || order.status === "cancelled");
}
