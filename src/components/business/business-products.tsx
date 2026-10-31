"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Pause, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatKES } from "@/lib/format";
import { productImage } from "@/lib/product-images";
import { getBusinessAvailability } from "@/lib/business-hours";
import { useBusiness } from "@/components/business/business-provider";
import { cn } from "@/lib/utils";

/**
 * Product management reads the station's own catalogue, so the prices and
 * stock shown here are the same ones the store validates orders against. Menu
 * visibility is kept per browser.
 */

const HIDDEN_KEY = "mf:hiddenProducts";

function readHidden(): string[] {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function BusinessProducts() {
  const { business } = useBusiness();
  const { toast } = useToast();
  const [hidden, setHidden] = useState<string[]>(readHidden);
  const availability = getBusinessAvailability(business.openingHours);

  const counts = useMemo(() => {
    const live = business.products.filter((p) => !hidden.includes(p.id)).length;
    return { live, total: business.products.length, low: business.products.filter((p) => p.stock <= p.stockLow).length };
  }, [business.products, hidden]);

  const toggle = (id: string, name: string) => {
    setHidden((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      toast({
        kind: "info",
        title: next.includes(id) ? `${name} hidden` : `${name} is live`,
        message: "Your menu is updated for customers right away.",
      });
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your station&apos;s catalog: {counts.live} of {counts.total} live
            {counts.low > 0 && <span className="text-warning"> · {counts.low} at reorder point</span>}
          </p>
        </div>
        <Button className="group" disabled title="Contact support to add a new product">
          <Plus className="size-4" aria-hidden /> New product
        </Button>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-white p-5 shadow-card">
        <Badge variant={availability.state === "open" ? "success" : "muted"}>{availability.hoursLabel}</Badge>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {counts.total} products are validated at checkout against the prices below. Hide an item to
          take it off the menu without deleting it.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {business.products.map((p) => {
          const isLive = !hidden.includes(p.id);
          return (
            <article
              key={p.id}
              className={cn(
                "rounded-2xl border bg-white p-5 shadow-card transition-opacity",
                isLive ? "border-border" : "border-border opacity-55"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand/10">
                  <Image src={productImage(p.image)} alt="" className="size-full object-cover" />
                </span>
                <Badge variant={isLive ? "softAccent" : "muted"}>{isLive ? "Live" : "Hidden"}</Badge>
              </div>
              <h2 className="mt-3 font-display text-lg text-foreground">{p.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="font-display text-xl text-foreground">
                  {formatKES(p.price)}
                  {p.oldPrice && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
                      {formatKES(p.oldPrice)}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs",
                    p.stock <= p.stockLow ? "text-danger" : "text-muted-foreground"
                  )}
                >
                  {p.stock} in stock
                </span>
              </div>
              <button
                onClick={() => toggle(p.id, p.name)}
                role="switch"
                aria-checked={isLive}
                className={cn(
                  "mt-4 flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-sm font-semibold transition-colors",
                  isLive ? "border-border text-foreground hover:bg-muted" : "border-[var(--brand)] text-[var(--brand)]"
                )}
              >
                {isLive ? <Pause className="size-4" aria-hidden /> : <Wrench className="size-4" aria-hidden />}
                {isLive ? "Hide from menu" : "Bring back"}
              </button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
