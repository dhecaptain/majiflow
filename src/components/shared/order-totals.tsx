import type { ReactNode } from "react";
import { Store, Truck } from "lucide-react";
import { formatKES } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CartTotals {
  subtotal: number;
  deliveryFee: number;
  deposit: number;
  total: number;
}

/**
 * The one fee breakdown, shared by the cart drawer, the cart page and the
 * checkout summary. Numbers always come from computeCartTotals - this only
 * renders them, so the three surfaces can never disagree again.
 */
export function OrderTotalsList({
  totals,
  pickup = false,
  className,
  totalClassName = "font-display text-2xl",
  children,
}: {
  totals: CartTotals;
  pickup?: boolean;
  className?: string;
  totalClassName?: string;
  children?: ReactNode;
}) {
  return (
    <dl className={cn("space-y-3 text-sm", className)}>
      <div className="flex items-center justify-between">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd className="font-semibold text-foreground">{formatKES(totals.subtotal)}</dd>
      </div>
      <div className="flex items-center justify-between">
        <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
          {pickup ? <Store className="size-4" aria-hidden /> : <Truck className="size-4" aria-hidden />}
          {pickup ? "Collection" : "Delivery"}
        </dt>
        <dd className="font-semibold text-foreground">
          {totals.deliveryFee === 0 ? <span className="text-success">Free</span> : formatKES(totals.deliveryFee)}
        </dd>
      </div>
      {totals.deposit > 0 && (
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Refundable deposit</dt>
          <dd className="font-semibold text-foreground">{formatKES(totals.deposit)}</dd>
        </div>
      )}
      {children}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <dt className="font-semibold text-foreground">Total</dt>
        <dd className={cn("text-foreground", totalClassName)}>{formatKES(totals.total)}</dd>
      </div>
    </dl>
  );
}
