import type {
  Business,
  DeliveryAddress,
  FulfillmentMethod,
  Order,
  OrderStatus,
  PaymentState,
} from "@/lib/types";
import { getBusinessOrderBlockReason } from "@/lib/business-hours";

/**
 * Customer-account rules shared by the account API and screens. Everything
 * here is pure so the same numbers render on the client and are enforced on
 * the server.
 */

import { ACTIVE_STATUSES } from "@/lib/order-status";

export { ACTIVE_STATUSES };
export const PAST_STATUSES: readonly OrderStatus[] = ["delivered", "rejected", "cancelled"];

/** Matches the server's payment confirmation window (PAYMENT_TIMEOUT_MS). */
export const PAYMENT_CONFIRMATION_WINDOW_MS = 15 * 60 * 1000;

export interface SavedAddress extends DeliveryAddress {
  id: string;
  isDefault: boolean;
}

export interface CustomerPreferences {
  /** Status messages for orders (SMS via the notification provider). */
  orderUpdates: boolean;
  /** Consent to offers and refill reminders; stored for when they ship. */
  marketing: boolean;
  notificationsReadAt: string | null;
  /** Delivery or pickup, so the next visit resumes the same choice. */
  fulfilment: FulfillmentMethod | null;
  /** Station the customer ordered from last, so we can preselect it. */
  lastStationId: string | null;
}

export interface CustomerAccountProfile {
  name: string;
  email: string;
  phone: string;
}

export type OrderFilter = "all" | "active" | "past";

export function isOrderFilter(value: unknown): value is OrderFilter {
  return value === "all" || value === "active" || value === "past";
}

export function filterOrders(orders: Order[], filter: OrderFilter): Order[] {
  if (filter === "active") return orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  if (filter === "past") return orders.filter((o) => PAST_STATUSES.includes(o.status));
  return orders;
}

export interface AccountMetrics {
  activeOrders: number;
  ordersPlaced: number;
  deliveredOrders: number;
  cansDelivered: number;
  /** Only verified payments count; refunds and unpaid orders are excluded. */
  totalSpent: number;
}

export function computeAccountMetrics(orders: Order[]): AccountMetrics {
  let activeOrders = 0;
  let deliveredOrders = 0;
  let cansDelivered = 0;
  let totalSpent = 0;
  for (const order of orders) {
    if (ACTIVE_STATUSES.includes(order.status)) activeOrders += 1;
    if (order.status === "delivered") {
      deliveredOrders += 1;
      cansDelivered += order.items.reduce((sum, item) => sum + item.quantity, 0);
    }
    if (order.paymentState === "success") totalSpent += order.total;
  }
  return {
    activeOrders,
    ordersPlaced: orders.length,
    deliveredOrders,
    cansDelivered,
    totalSpent: Math.round(totalSpent * 100) / 100,
  };
}

export interface AccountEvent {
  id: string;
  orderId: string;
  orderNumber: string;
  businessName: string;
  total: number;
  status: OrderStatus;
  at: string;
}

/** Notification history derived from the real, server-recorded order timelines. */
export function buildAccountEvents(orders: Order[]): AccountEvent[] {
  return orders
    .flatMap((order) =>
      (order.timeline?.length ? order.timeline : [{ status: order.status, at: order.placedAt }]).map(
        (entry, index) => ({
          id: `${order.id}:${index}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          businessName: order.businessName,
          total: order.total,
          status: entry.status,
          at: entry.at,
        })
      )
    )
    .sort((a, b) => b.at.localeCompare(a.at));
}

export function countUnread(events: AccountEvent[], readAt: string | null): number {
  if (!readAt) return events.length;
  const cutoff = Date.parse(readAt);
  if (Number.isNaN(cutoff)) return events.length;
  return events.filter((e) => Date.parse(e.at) > cutoff).length;
}

const SETTLED_UNPAID: readonly PaymentState[] = ["failed", "cancelled", "timeout"];

/**
 * A customer may cancel only before the station accepts, and only when no
 * money has moved or can still move: paid orders go through the refund flow,
 * and a payment still inside its confirmation window could yet succeed.
 */
export function cancelBlockReason(
  order: Order,
  now = Date.now(),
  windowMs = PAYMENT_CONFIRMATION_WINDOW_MS
): string | null {
  if (order.status !== "pending") return "Only orders the station hasn't accepted yet can be cancelled.";
  if (order.paymentState === "success" || order.paymentState === "refunded")
    return "This order is paid - contact support to cancel and get a refund.";
  if (SETTLED_UNPAID.includes(order.paymentState)) return null;
  const placed = Date.parse(order.placedAt);
  if (Number.isNaN(placed) || now - placed < windowMs)
    return "Your payment is still being confirmed - try again in a few minutes.";
  return null;
}

export interface ReorderLine {
  businessId: string;
  productId: string;
  quantity: number;
  /** The option the original order used, so the reorder keeps the same choice. */
  optionId?: string;
}

export interface ReorderPlan {
  businessId: string;
  businessName: string;
  lines: ReorderLine[];
  skipped: { name: string; reason: string }[];
  priceChanges: { name: string; from: number; to: number }[];
  /** Set when the station can't take orders right now; lines may still go to the cart. */
  notice: string | null;
}

/**
 * Rebuild an order against today's catalog. Prices are never copied from the
 * old order - checkout re-prices everything - but changes are surfaced so the
 * customer isn't surprised.
 */
export function planReorder(order: Order, catalog: Business[], now = new Date()): ReorderPlan | { error: string } {
  const business = catalog.find((b) => b.id === order.businessId);
  if (!business) return { error: `${order.businessName} is no longer on MajiFlow.` };

  const products = new Map(business.products.map((p) => [p.id, p]));
  const lines: ReorderLine[] = [];
  const skipped: ReorderPlan["skipped"] = [];
  const priceChanges: ReorderPlan["priceChanges"] = [];

  for (const item of order.items) {
    const product = products.get(item.productId);
    if (!product) {
      skipped.push({ name: item.name, reason: "No longer sold" });
      continue;
    }
    if (product.stock <= 0) {
      skipped.push({ name: product.name, reason: "Out of stock" });
      continue;
    }
    const quantity = Math.min(item.quantity, product.stock);
    if (quantity < item.quantity) {
      skipped.push({ name: product.name, reason: `Only ${product.stock} available` });
    }
    // Re-pricing keeps the choice the customer made, so a can swap is compared
    // against the same option's price today.
    const option = item.optionId
      ? product.options?.find((candidate) => candidate.id === item.optionId)
      : undefined;
    const currentPrice = product.price + (option?.priceDelta ?? 0);
    if (Math.abs(currentPrice - item.unitPrice) > 0.001) {
      priceChanges.push({ name: product.name, from: item.unitPrice, to: currentPrice });
    }
    lines.push({
      businessId: business.id,
      productId: product.id,
      quantity,
      ...(item.optionId ? { optionId: item.optionId } : {}),
    });
  }

  if (lines.length === 0) return { error: "None of the items from this order are available right now." };

  return {
    businessId: business.id,
    businessName: business.name,
    lines,
    skipped,
    priceChanges,
    notice: getBusinessOrderBlockReason(business, now),
  };
}
