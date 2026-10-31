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
import type { Order } from "@/lib/types";

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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
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
