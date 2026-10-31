"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, MapPin, Navigation, Package, Phone, RefreshCw } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { OrderStatusBadge } from "@/components/ui/order-status-badge";
import { formatPhone } from "@/lib/format";
import type { RiderOrderView } from "@/lib/server/fulfillment";

type Load =
  | { kind: "loading" }
  | { kind: "ready"; order: RiderOrderView }
  | { kind: "gone"; message: string }
  | { kind: "error" };

function mapsUrl(order: RiderOrderView) {
  const { lat, lng } = order.address;
  if (typeof lat === "number" && typeof lng === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const query = [order.address.street, order.address.building, order.address.estate, order.address.city]
    .filter(Boolean)
    .join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Mobile-first screen for the rider holding a one-time delivery link. */
export function RiderDelivery({ token }: { token: string }) {
  const [state, setState] = useState<Load>({ kind: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = `/api/rider/${encodeURIComponent(token)}`;

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { order?: RiderOrderView; error?: string };
      if (res.status === 404) setState({ kind: "gone", message: data.error ?? "This delivery link is no longer active." });
      else if (!res.ok || !data.order) setState({ kind: "error" });
      else setState({ kind: "ready", order: data.order });
    } catch {
      setState({ kind: "error" });
    }
  }, [url]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch
    void load();
  }, [load]);

  const act = async (action: "pickup" | "deliver") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { order?: RiderOrderView; error?: string };
      if (res.ok && data.order) setState({ kind: "ready", order: data.order });
      else if (res.status === 404) setState({ kind: "gone", message: data.error ?? "This delivery link is no longer active." });
      else setError(data.error ?? "That could not be saved. Please try again.");
    } catch {
      setError("No connection. Check your data and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (state.kind === "loading") {
    return (
      <Container className="py-16">
        <LoadingState label="Loading delivery…" />
      </Container>
    );
  }

  if (state.kind === "gone") {
    return (
      <Container className="py-16">
        <ErrorState
          title="Link no longer active"
          message={`${state.message} If you still have this delivery, ask the station for a new link.`}
        />
      </Container>
    );
  }

  if (state.kind === "error") {
    return (
      <Container className="py-16">
        <ErrorState
          title="Could not load the delivery"
          message="Check your connection and try again."
          action={
            <Button onClick={() => void load()} className="gap-2">
              <RefreshCw className="size-4" aria-hidden /> Retry
            </Button>
          }
        />
      </Container>
    );
  }

  const { order } = state;
  const delivered = order.status === "delivered";
  const address = [order.address.street, order.address.estate, order.address.city].filter(Boolean).join(", ");

  return (
    <Container className="max-w-xl py-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {order.businessName} · {order.orderNumber}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-foreground">
          {delivered ? "Delivered - thank you" : `Hi ${order.riderName.split(" ")[0] || "rider"}`}
        </h1>
        <OrderStatusBadge status={order.status} />
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <section aria-labelledby="dropoff-heading" className="mt-6 rounded-2xl border border-border bg-white p-5 shadow-card">
        <h2 id="dropoff-heading" className="flex items-center gap-2 font-display text-lg text-foreground">
          <MapPin className="size-5 text-[var(--brand)]" aria-hidden /> Drop-off
        </h2>
        <p className="mt-2 text-base font-semibold text-foreground">{address || order.address.estate}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {[order.address.building, order.address.floor].filter(Boolean).join(" · ") || "No building info"}
        </p>
        {order.address.notes && <p className="mt-2 text-sm italic text-muted-foreground">“{order.address.notes}”</p>}
        <p className="mt-3 text-sm text-foreground">{order.customerName}</p>
        {!delivered && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href={`tel:${order.customerPhone}`}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-muted"
              aria-label={`Call ${order.customerName} on ${formatPhone(order.customerPhone)}`}
            >
              <Phone className="size-4" aria-hidden /> Call customer
            </a>
            <a
              href={mapsUrl(order)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Navigation className="size-4" aria-hidden /> Directions
            </a>
          </div>
        )}
      </section>

      <section aria-labelledby="items-heading" className="mt-4 rounded-2xl border border-border bg-white p-5 shadow-card">
        <h2 id="items-heading" className="flex items-center gap-2 font-display text-lg text-foreground">
          <Package className="size-5 text-[var(--brand)]" aria-hidden /> Items
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm text-foreground">
          {order.items.map((item) => (
            <li key={item.productId}>
              {item.quantity} × {item.name}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-6">
        {order.status === "rider_assigned" && (
          <Button size="lg" className="h-14 w-full text-base" onClick={() => void act("pickup")} disabled={busy}>
            {busy ? "Saving…" : "Picked up - start delivery"}
          </Button>
        )}
        {order.status === "out_for_delivery" && (
          <Button size="lg" className="h-14 w-full text-base" onClick={() => void act("deliver")} disabled={busy}>
            {busy ? "Saving…" : "Delivered to customer"}
          </Button>
        )}
        {delivered && (
          <p role="status" className="flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">
            <CheckCircle2 className="size-5" aria-hidden /> Delivery complete. This link is now closed.
          </p>
        )}
      </div>
    </Container>
  );
}
