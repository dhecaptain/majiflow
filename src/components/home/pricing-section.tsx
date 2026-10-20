"use client";

import Link from "next/link";
import { useState } from "react";
import { SectionScreen } from "@/components/ui/section-screen";
import { SectionHeading } from "@/components/ui/section-heading";
import { PricingCard } from "@/components/shared/pricing-card";
import { Stagger, StaggerItem } from "@/components/ui/animated-section";
import { plans } from "@/lib/data/plans";
import { cn } from "@/lib/utils";

export function PricingSection() {
  const [annual, setAnnual] = useState(true);

  return (
    <SectionScreen id="pricing">
      <SectionHeading
        label="Pricing"
        title={
          <>
            Simple plans that <span className="text-gradient">grow with you</span>
          </>
        }
        description="Flat monthly pricing in Kenyan Shillings. Every plan starts with a 14-day free trial."
      />

      <div className="mt-8 flex justify-center">
        <BillingToggle annual={annual} onChange={setAnnual} />
      </div>

      <Stagger className="mt-10 grid gap-5 lg:grid-cols-3" stagger={0.08}>
        {plans.map((plan) => (
          <StaggerItem key={plan.id}>
            <PricingCard plan={plan} annual={annual} />
          </StaggerItem>
        ))}
      </Stagger>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        No setup fees and no commission on orders.{" "}
        <Link href="/pricing" className="font-semibold text-[#0052FF] hover:underline">
          Compare plans
        </Link>
      </p>
    </SectionScreen>
  );
}

function BillingToggle({ annual, onChange }: { annual: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-card p-1 text-sm shadow-card"
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
            "rounded-full px-4 py-1.5 font-semibold transition-colors",
            annual === option.id ? "bg-[#0052FF] text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
          {option.id && <span className="ml-1.5 text-[11px] font-medium opacity-80">save 17%</span>}
        </button>
      ))}
    </div>
  );
}
