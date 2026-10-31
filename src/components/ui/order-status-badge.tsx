import { Badge } from "@/components/ui/badge";
import type { Order, OrderStatus, PaymentState } from "@/lib/types";
import { isActiveStatus } from "@/lib/order-status";
import { cn } from "@/lib/utils";

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: "warning" | "softAccent" | "accent" | "success" | "danger" | "muted"; dot: string }
> = {
  pending: { label: "Pending", tone: "warning", dot: "bg-warning" },
  accepted: { label: "Accepted", tone: "softAccent", dot: "bg-[var(--brand)]" },
  preparing: { label: "Preparing", tone: "softAccent", dot: "bg-[var(--brand)]" },
  rider_assigned: { label: "Rider assigned", tone: "accent", dot: "bg-[var(--brand-bright)]" },
  out_for_delivery: { label: "Out for delivery", tone: "accent", dot: "bg-[var(--brand-bright)]" },
  delivered: { label: "Delivered", tone: "success", dot: "bg-success" },
  rejected: { label: "Rejected", tone: "danger", dot: "bg-danger" },
  cancelled: { label: "Cancelled", tone: "muted", dot: "bg-muted-foreground" },
};

export function OrderStatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = ORDER_STATUS_META[status];
  const live = status !== "pending" && isActiveStatus(status);
  return (
    <Badge variant={meta.tone} className={cn(className)}>
      <span className="relative flex size-1.5">
        {live && (
          <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 animate-ping" />
        )}
        <span className={cn("relative inline-flex size-1.5 rounded-full", meta.dot)} />
      </span>
      {meta.label}
    </Badge>
  );
}

export const PAYMENT_STATE_META: Record<PaymentState, { label: string; tone: "warning" | "success" | "danger" }> = {
  pending: { label: "Payment pending", tone: "warning" },
  success: { label: "Paid", tone: "success" },
  failed: { label: "Payment failed", tone: "danger" },
  cancelled: { label: "Payment cancelled", tone: "warning" },
  timeout: { label: "Payment timed out", tone: "danger" },
  refunded: { label: "Refunded", tone: "success" },
};

/** How an order's payment reads to people: an unpaid pay-on-delivery order is not "pending payment". */
export function paymentMeta(order: Pick<Order, "payment" | "paymentState">) {
  if (order.payment === "cod" && order.paymentState === "pending") {
    return { label: "Pay on delivery", tone: "warning" as const };
  }
  return PAYMENT_STATE_META[order.paymentState];
}
