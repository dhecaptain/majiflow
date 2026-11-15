"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { useCart } from "@/components/order/cart-provider";
import { useToast } from "@/components/ui/toast";
import { accountApi, type AccountResult } from "@/lib/account-client";
import { formatKES } from "@/lib/format";
import type { Order, OrderStatus } from "@/lib/types";
import { ORDER_STATUS_META } from "@/components/ui/order-status-badge";
import { cn } from "@/lib/utils";

export type Resource<T> =
  | { status: "loading" }
  | { status: "error"; error: string; code: number }
  | { status: "ready"; data: T };

/**
 * Load account data with explicit loading / error / ready states and a retry.
 * `key` re-runs the request (e.g. when a filter changes).
 */
export function useAccountResource<T>(key: string, load: () => Promise<AccountResult<T>>) {
  const [resource, setResource] = useState<Resource<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let alive = true;
    void loadRef.current().then((result) => {
      if (!alive) return;
      setResource(
        result.ok
          ? { status: "ready", data: result.data }
          : { status: "error", error: result.error, code: result.status }
      );
    });
    return () => {
      alive = false;
    };
  }, [key, attempt]);

  const reload = useCallback(() => {
    setResource({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  /** Swap in fresh data returned by a mutation without another round trip. */
  const replace = useCallback((data: T) => setResource({ status: "ready", data }), []);

  return { resource, reload, replace };
}

export function AccountError({ message, code, onRetry }: { message: string; code?: number; onRetry: () => void }) {
  return (
    <ErrorState
      title={code === 401 ? "Signed out" : "Couldn't load this"}
      message={message}
      action={
        code === 401 ? (
          <Link href="/login" className={buttonVariants()}>Sign in again</Link>
        ) : (
          <Button variant="secondary" onClick={onRetry}>
            <RefreshCcw className="size-4" aria-hidden /> Try again
          </Button>
        )
      }
    />
  );
}

export function AccountPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">{eyebrow}</p>}
        <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Page wrapper inside the account shell: phone gutters, flush with the sidebar column on desktop. */
export const ACCOUNT_PAGE = "w-full px-4 py-5 sm:px-6 lg:px-0 lg:py-0";

/** Shared card surface for the customer account and tracking screens. */
export const CARD = "rounded-xl border border-border bg-white p-4";

/** Customer-facing status pill colours: on the way, delivered, closed, waiting. */
function statusPillClass(status: OrderStatus): string {
  if (status === "delivered") return "bg-success-soft text-success";
  if (status === "cancelled" || status === "rejected") return "bg-danger-soft text-danger";
  if (status === "pending") return "bg-warning-soft text-warning";
  return "bg-aqua-soft text-[#00707d]";
}

export function CustomerStatusPill({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold",
        statusPillClass(status),
        className
      )}
    >
      {ORDER_STATUS_META[status].label}
    </span>
  );
}

export const PROGRESS_STEPS = ["Placed", "Accepted", "Preparing", "On the way", "Delivered"] as const;

/** Index of the step an order is on (0-4), or -1 once it closed without delivery. */
export function progressIndex(status: OrderStatus): number {
  switch (status) {
    case "pending":
      return 0;
    case "accepted":
      return 1;
    case "preparing":
      return 2;
    case "rider_assigned":
    case "out_for_delivery":
      return 3;
    case "delivered":
      return 4;
    default:
      return -1;
  }
}

/**
 * Five-segment order progress: done steps in brand blue, the current one in
 * aqua, the rest in the border colour. Labels are optional (tiny, under the bar).
 */
export function OrderProgress({
  status,
  labels = false,
  className,
}: {
  status: OrderStatus;
  labels?: boolean;
  className?: string;
}) {
  const current = progressIndex(status);
  const delivered = status === "delivered";
  return (
    <ol aria-label="Order progress" className={cn("grid grid-cols-5 gap-1", className)}>
      {PROGRESS_STEPS.map((label, i) => {
        const done = i < current || (delivered && i === current);
        const now = i === current && !delivered;
        return (
          <li key={label} className="flex flex-col gap-1.5" aria-current={now ? "step" : undefined}>
            <span
              aria-hidden
              className={cn("block h-1.5 rounded-full", done ? "bg-[var(--brand)]" : now ? "bg-aqua" : "bg-border")}
            />
            <span
              className={cn(
                labels ? "text-[11px] leading-tight" : "sr-only",
                now ? "font-extrabold text-foreground" : done ? "font-semibold text-foreground" : "font-semibold text-muted-foreground"
              )}
            >
              {label}
              <span className="sr-only">{now ? " (current step)" : done ? " (done)" : " (upcoming)"}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function itemsSummary(order: Pick<Order, "items">) {
  return order.items.map((i) => `${i.quantity} × ${i.name.split(" - ")[0].trim()}`).join(", ");
}

/**
 * Re-add a past order to the cart via the server's catalog check, then head
 * to the cart. Price changes, missing items, and closed stations are spelled
 * out so nothing is silently different from last time.
 */
export function useReorder() {
  const { addItem } = useCart();
  const { toast } = useToast();
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const reorder = useCallback(
    async (orderId: string) => {
      setPendingId(orderId);
      const result = await accountApi.reorder(orderId);
      setPendingId(null);
      if (!result.ok) {
        toast({ kind: "error", title: "Couldn't reorder", message: result.error });
        return;
      }
      const { plan } = result.data;
      plan.lines.forEach((line) => addItem(line));
      const notes = [
        ...plan.skipped.map((s) => `${s.name}: ${s.reason.toLowerCase()}`),
        ...plan.priceChanges.map((p) => `${p.name} is now ${formatKES(p.to)} (was ${formatKES(p.from)})`),
        plan.notice,
      ].filter(Boolean);
      const count = plan.lines.reduce((n, l) => n + l.quantity, 0);
      toast({
        kind: notes.length ? "info" : "success",
        title: `${count} item${count === 1 ? "" : "s"} from ${plan.businessName} added`,
        message: notes.length ? notes.join(" · ") : "Review your cart and check out when ready.",
      });
      router.push("/cart");
    },
    [addItem, router, toast]
  );

  return { reorder, pendingId };
}
