"use client";

import Link from "next/link";
import { AlertCircle, Check, CreditCard, Smartphone } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKES } from "@/lib/format";
import { plans } from "@/lib/data/plans";
import { useBusiness } from "@/components/business/business-provider";
import { cn } from "@/lib/utils";

/**
 * Billing and plan management.
 */

export function BusinessBilling() {
  const { business } = useBusiness();
  const current = plans.find((p) => p.id === business.subscription) ?? plans[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">Billing & plan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your station is subscribed to the <strong className="text-foreground">{current.name}</strong> plan.
          </p>
        </div>
        <Badge variant="softAccent">{business.subscription}</Badge>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-white p-5 shadow-card">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">Your next invoice</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Your plan renews on the first of each month. Change your plan or update your payment
            method any time below; both take effect on your next invoice.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === business.subscription;
          return (
            <article
              key={p.id}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-white p-6 shadow-card",
                isCurrent ? "border-[var(--brand)] ring-2 ring-[var(--brand)]/15" : "border-border"
              )}
            >
              {isCurrent && (
                <span className="absolute -top-3 left-6 rounded-full bg-foreground px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-white">
                  Your plan
                </span>
              )}
              <h2 className="font-display text-xl text-foreground">{p.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.audience}</p>
              <p className="mt-3 font-display text-3xl text-foreground">
                {formatKES(p.monthlyPrice)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/month</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatKES(p.annualPrice)}/year · {p.trialDays}-day free trial
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-muted-foreground">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-[var(--brand)]" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button variant="secondary" className="mt-6 w-full" disabled>
                  Current plan
                </Button>
              ) : (
                <Link
                  href={`/contact?topic=plan&plan=${p.id}`}
                  className={buttonVariants({ variant: "outline", className: "mt-6 w-full" })}
                >
                  Ask to switch to {p.name}
                </Link>
              )}
            </article>
          );
        })}
      </div>

      <section className="rounded-2xl border border-border bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
            <CreditCard className="size-5 text-[var(--brand)]" aria-hidden /> Invoices
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            No invoices yet. When your free trial ends, our team contacts you to set up billing for
            your plan, and your invoices are listed here.
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="size-3.5" aria-hidden /> Customer payments from your orders appear
            against each order in the Orders screen.
          </p>
        </div>
      </section>
    </div>
  );
}
