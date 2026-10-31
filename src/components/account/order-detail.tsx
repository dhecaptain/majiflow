"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, MapPin, Navigation, PackageX, RotateCcw, XCircle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { ORDER_STATUS_META, OrderStatusBadge, PAYMENT_STATE_META } from "@/components/ui/order-status-badge";
import { useToast } from "@/components/ui/toast";
import { AccountError, AccountPageHeader, useAccountResource, useReorder } from "@/components/account/account-ui";
import { ACTIVE_STATUSES } from "@/lib/account";
import { accountApi } from "@/lib/account-client";
import { formatKES } from "@/lib/format";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OrderDetailPage({ id }: { id: string }) {
  const { resource, reload, replace } = useAccountResource(id, () => accountApi.order(id));
  const { reorder, pendingId } = useReorder();
  const { toast } = useToast();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const back = (
    <Link
      href="/account/orders"
      className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden /> All orders
    </Link>
  );

  if (resource.status === "loading") {
    return (
      <Container className="py-6 lg:py-8">
        {back}
        <LoadingState label="Loading order…" />
      </Container>
    );
  }

  if (resource.status === "error") {
    return (
      <Container className="py-6 lg:py-8">
        {back}
        {resource.code === 404 ? (
          <EmptyState
            icon={<PackageX className="size-7" aria-hidden />}
            title="Order not found"
            description="This order doesn't exist or belongs to a different account."
            action={
              <Link href="/account/orders">
                <Button>See your orders</Button>
              </Link>
            }
          />
        ) : (
          <AccountError message={resource.error} code={resource.code} onRetry={reload} />
        )}
      </Container>
    );
  }

  const { order, cancelBlockReason } = resource.data;
  const active = ACTIVE_STATUSES.includes(order.status);
  const payment = PAYMENT_STATE_META[order.paymentState];
  const timeline = [...(order.timeline ?? [])].reverse();

  const cancel = async () => {
    setCancelling(true);
    const result = await accountApi.cancelOrder(order.id);
    setCancelling(false);
    setConfirmCancel(false);
    if (!result.ok) {
      toast({ kind: "error", title: "Couldn't cancel", message: result.error });
      reload();
      return;
    }
    replace({ order: result.data.order, cancelBlockReason: "This order is already cancelled." });
    toast({ kind: "success", title: "Order cancelled", message: `${order.orderNumber} won't be delivered.` });
  };

  return (
    <Container className="py-6 lg:py-8">
      {back}
      <AccountPageHeader
        eyebrow={
          <>
            {order.orderNumber} · <time dateTime={order.placedAt}>{formatDateTime(order.placedAt)}</time>
          </>
        }
        title={order.businessName}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <Badge variant={payment.tone}>{payment.label}</Badge>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section aria-labelledby="order-items" className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 id="order-items" className="font-display text-lg text-foreground">
              Items
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {order.items.map((item) => (
                <li key={`${item.productId}-${item.optionId ?? ""}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span className="text-foreground">
                    {item.quantity} × {item.name}
                    {item.optionLabel && (
                      <span className="block text-xs font-medium text-[var(--brand)]">{item.optionLabel}</span>
                    )}
                  </span>
                  <span className="font-medium text-foreground">{formatKES(item.unitPrice * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>Subtotal</dt>
                <dd>{formatKES(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <dt>{order.fulfilment === "pickup" ? "Collection" : "Delivery"}</dt>
                <dd>{order.deliveryFee ? formatKES(order.deliveryFee) : "Free"}</dd>
              </div>
              {order.deposit ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>Refundable deposit</dt>
                  <dd>{formatKES(order.deposit)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-foreground">
                <dt>Total</dt>
                <dd>{formatKES(order.total)}</dd>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <dt>Paid with</dt>
                <dd>{order.payment === "mpesa" ? "M-Pesa" : "Card"}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="order-timeline" className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 id="order-timeline" className="font-display text-lg text-foreground">
              History
            </h2>
            {timeline.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No status updates yet.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {timeline.map((entry, index) => (
                  <li key={`${entry.status}-${entry.at}`} className="flex items-start gap-3 text-sm">
                    <span
                      aria-hidden
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${ORDER_STATUS_META[entry.status].dot}`}
                    />
                    <div>
                      <p className={index === 0 ? "font-semibold text-foreground" : "text-foreground/80"}>
                        {ORDER_STATUS_META[entry.status].label}
                      </p>
                      <time dateTime={entry.at} className="text-xs text-muted-foreground">
                        {formatDateTime(entry.at)}
                      </time>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section aria-labelledby="order-actions" className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 id="order-actions" className="sr-only">
              Actions
            </h2>
            <div className="flex flex-col gap-2">
              {active && (
                <Link href={`/order/${order.id}`}>
                  <Button className="w-full">
                    <Navigation className="size-4" aria-hidden /> Track live
                  </Button>
                </Link>
              )}
              <Button
                variant={active ? "secondary" : "default"}
                className="w-full"
                disabled={pendingId === order.id}
                aria-busy={pendingId === order.id}
                onClick={() => reorder(order.id)}
              >
                <RotateCcw className="size-4" aria-hidden />
                {pendingId === order.id ? "Adding to cart…" : "Reorder"}
              </Button>
              {cancelBlockReason === null ? (
                <Button variant="outline" className="w-full text-danger" onClick={() => setConfirmCancel(true)}>
                  <XCircle className="size-4" aria-hidden /> Cancel order
                </Button>
              ) : (
                order.status === "pending" && (
                  <p className="text-xs text-muted-foreground">{cancelBlockReason}</p>
                )
              )}
            </div>
          </section>

          <section aria-labelledby="order-address" className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 id="order-address" className="font-display text-lg text-foreground">
              Delivery
            </h2>
            <div className="mt-3 flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden />
              <address className="not-italic text-foreground/85">
                <span className="font-semibold text-foreground">{order.address.label}</span>
                <br />
                {[order.address.building, order.address.floor].filter(Boolean).join(", ")}
                {(order.address.building || order.address.floor) && <br />}
                {[order.address.street, order.address.estate, order.address.city].filter(Boolean).join(", ")}
                {order.address.landmark && (
                  <>
                    <br />
                    Near {order.address.landmark}
                  </>
                )}
                <br />
                {order.customerName} · {order.customerPhone}
              </address>
            </div>
            {order.address.notes && (
              <p className="mt-2 text-xs italic text-muted-foreground">“{order.address.notes}”</p>
            )}
          </section>
        </div>
      </div>

      <Dialog
        open={confirmCancel}
        onClose={() => !cancelling && setConfirmCancel(false)}
        title={`Cancel ${order.orderNumber}?`}
        description={`${order.businessName} won't deliver this order. You can reorder any time.`}
      >
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={cancelling} onClick={() => setConfirmCancel(false)}>
            Keep order
          </Button>
          <Button variant="danger" disabled={cancelling} aria-busy={cancelling} onClick={cancel}>
            {cancelling ? "Cancelling…" : "Cancel order"}
          </Button>
        </div>
      </Dialog>
    </Container>
  );
}
