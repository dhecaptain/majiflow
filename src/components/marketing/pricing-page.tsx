"use client";

import { useState } from "react";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { PageHero, PageSection } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { PricingCard } from "@/components/shared/pricing-card";
import { Accordion } from "@/components/ui/accordion";
import { plans } from "@/lib/data/plans";
import type { Plan, PlanName } from "@/lib/types";
import { cn } from "@/lib/utils";

const comparison: { feature: string; plans: (string | boolean)[] }[] = [
  { feature: "Business profile & online menu", plans: [true, true, true] },
  { feature: "Orders from the website", plans: [true, true, true] },
  { feature: "Pay on delivery (cash or M-Pesa)", plans: [true, true, true] },
  { feature: "Sales reports from your orders", plans: [true, true, true] },
  { feature: "Stock alerts", plans: [false, true, true] },
  { feature: "Advanced analytics & charts", plans: [false, true, true] },
  { feature: "Promotions dashboard", plans: [false, true, true] },
  { feature: "Staff accounts", plans: [false, "Planned", "Planned"] },
  { feature: "Customer SMS & WhatsApp updates", plans: [false, "Planned", "Planned"] },
  { feature: "Card payments", plans: ["Planned", "Planned", "Planned"] },
  { feature: "Multiple branches & fleets", plans: [false, false, "Planned"] },
];

const planIds: PlanName[] = ["starter", "growth", "pro"];

export function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p])) as Record<PlanName, Plan>;

  return (
    <>
      <PageHero
        label="Pricing for stations"
        title="A flat subscription, not a commission"
        description="Monthly pricing in Kenyan Shillings. Every plan starts with a 14-day free trial, and you keep the full price customers pay."
      >
        <BillingToggle annual={annual} onChange={setAnnual} />
      </PageHero>

      <PageSection className="!pt-8 lg:!pt-12">
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} annual={annual} />
          ))}
        </div>
        <p className="mt-5 flex items-start gap-2.5 rounded-lg bg-success-soft px-4 py-3 text-sm leading-relaxed text-[#14532d]">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          No setup fee and no commission. You keep the full KES price customers pay, and you can cancel any time.
        </p>
      </PageSection>

      <PageSection tinted>
        <SectionHeading label="Compare plans" title="What is included, and what is next" />
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-white">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-5 py-3.5 text-left text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Feature
                </th>
                {planIds.map((id) => (
                  <th key={id} scope="col" className="px-5 py-3.5 text-center">
                    <span className={cn("text-[15px] font-extrabold", planMap[id].highlighted ? "text-[var(--brand)]" : "text-foreground")}>
                      {planMap[id].name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr key={row.feature} className="border-b border-[#eef3fa] last:border-0">
                  <td className="px-5 py-3 font-medium text-foreground">{row.feature}</td>
                  {row.plans.map((val, i) => (
                    <td key={i} className="px-5 py-3 text-center">
                      {val === true ? (
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-success-soft text-success">
                          <Check className="size-3.5" strokeWidth={3} aria-label="Included" />
                        </span>
                      ) : val === false ? (
                        <span className="inline-flex size-6 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
                          <Minus className="size-3.5" aria-label="Not included" />
                        </span>
                      ) : (
                        <span className="rounded-full bg-aqua-soft px-2 py-0.5 text-xs font-bold text-[#00707d]">{val}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PageSection>

      <PageSection narrow>
        <SectionHeading label="Billing questions" title="Before you subscribe" />
        <Accordion
          className="mt-6"
          items={[
            { q: "How does the free trial work?", a: "Every plan starts with a 14-day free trial. We only charge you once the trial ends, and you can cancel before then at no cost." },
            { q: "How do my customers pay?", a: "Customers pay on delivery, by cash or M-Pesa to your rider or at your counter, so the money comes straight to you. Card payments are planned." },
            { q: "Can I change plans at any time?", a: "Yes. Move up or down between plans from your billing settings, and the change is prorated on your next invoice." },
            { q: "Is there a commission on orders?", a: "No. You pay a flat monthly subscription and keep the full price your customers pay." },
          ]}
        />
      </PageSection>
    </>
  );
}

function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-white p-1 text-sm"
      role="group"
      aria-label="Billing period"
    >
      {[
        { id: false, label: "Monthly" },
        { id: true, label: "Annual" },
      ].map((option) => (
        <button
          key={String(option.id)}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={annual === option.id}
          className={cn(
            "min-h-10 rounded-full px-4 font-semibold transition-colors",
            annual === option.id ? "bg-[var(--brand)] text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
          {option.id && <span className="ml-1.5 text-[11px] font-medium opacity-80">save 17%</span>}
        </button>
      ))}
    </div>
  );
}
