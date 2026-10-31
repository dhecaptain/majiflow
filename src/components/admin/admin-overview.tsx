"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Banknote, Building2, ClipboardCheck, Download, MapPin, Package, Radio, Search, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedSection, Stagger, StaggerItem } from "@/components/ui/animated-section";
import { formatKES } from "@/lib/format";
import { businesses } from "@/lib/data/businesses";
import { plans } from "@/lib/data/plans";
import { cn } from "@/lib/utils";

type PlanId = (typeof businesses)[number]["subscription"];

const PLAN_TONE: Record<PlanId, "softAccent" | "accent" | "success"> = {
  starter: "softAccent",
  growth: "accent",
  pro: "success",
};

const PLAN_PRICE: Record<PlanId, number> = plans.reduce(
  (acc, plan) => ({ ...acc, [plan.id]: plan.monthlyPrice }),
  {} as Record<PlanId, number>
);

const ROWS = businesses.map((b) => ({
  id: b.id,
  name: b.name,
  area: `${b.estates[0] ?? b.city}, ${b.city}`,
  plan: b.subscription,
  monthly: PLAN_PRICE[b.subscription],
  products: b.products.length,
  verified: b.verified,
}));

function planLabel(plan: PlanId) {
  return plan[0].toUpperCase() + plan.slice(1);
}

export function AdminOverview() {
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const filtered = ROWS.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.area.toLowerCase().includes(q.toLowerCase())
  );

  const active = ROWS.filter((r) => r.verified).length;
  const mrr = ROWS.reduce((total, r) => total + r.monthly, 0);
  const productCount = ROWS.reduce((total, r) => total + r.products, 0);
  const cityCount = new Set(businesses.map((b) => b.city)).size;

  const kpis = [
    { icon: Building2, label: "Active stations", value: String(active), hint: `${ROWS.length} listed on the platform` },
    { icon: Banknote, label: "Platform MRR", value: formatKES(mrr), hint: "From active subscriptions" },
    { icon: Package, label: "Products listed", value: String(productCount), hint: "Across every catalogue" },
    { icon: MapPin, label: "Cities covered", value: String(cityCount), hint: "Kenya-wide coverage" },
  ];

  return (
    <Container className="py-10 lg:py-14">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 60% at 90% -10%, rgba(0,87,230,0.14), transparent 60%)",
          }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-[var(--brand)]" aria-hidden /> Platform admin
            </p>
            <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">MajiFlow control room</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Every station and subscription across Kenya, in one view.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin/orders">
              <Button variant="secondary" className="gap-2">
                <Radio className="size-4" aria-hidden /> Live orders
              </Button>
            </Link>
            <Link href="/admin/applications">
              <Button variant="secondary" className="gap-2">
                <ClipboardCheck className="size-4" aria-hidden /> Applications
              </Button>
            </Link>
            <Button className="gap-2" onClick={() => setNote("Platform report exported as CSV.")}>
              <Download className="size-4" aria-hidden /> Export report
            </Button>
          </div>
        </div>
      </div>

      {note && (
        <div role="status" className="mt-6 flex items-center justify-between rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/5 px-4 py-3 text-sm text-[var(--brand)]">
          {note}
          <button onClick={() => setNote(null)} className="font-semibold" aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}

      {/* Platform KPIs */}
      <Stagger className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.07}>
        {kpis.map((k) => (
          <StaggerItem key={k.label}>
            <div className="h-full rounded-2xl border border-border bg-card p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-layered">
              <span className="flex size-9 items-center justify-center rounded-lg bg-cta-soft text-[var(--brand)]">
                <k.icon className="size-4.5" aria-hidden />
              </span>
              <p className="mt-3 font-display text-2xl text-foreground">{k.value}</p>
              <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
              <p className="mt-1 text-[11px] text-muted-foreground/70">{k.hint}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Stations */}
      <AnimatedSection className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-display text-lg text-foreground">Stations</h2>
          <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border px-3 py-2 sm:w-72">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stations or areas…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              aria-label="Search stations"
            />
          </div>
        </div>

        {/* Mobile cards */}
        <ul className="flex flex-col gap-3 p-4 md:hidden">
          {filtered.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-background p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted font-display text-xs text-foreground">
                  {r.name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.area}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <Badge variant={PLAN_TONE[r.plan]}>{planLabel(r.plan)}</Badge>
                <span className="font-medium text-foreground">{formatKES(r.monthly)}/mo</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{r.products} products</span>
                <span className={cn("inline-flex items-center gap-1.5 font-medium", r.verified ? "text-success" : "text-warning")}>
                  <span className={cn("size-1.5 rounded-full", r.verified ? "bg-success" : "bg-warning")} />
                  {r.verified ? "Live" : "Pending"}
                </span>
              </div>
              <Link href="/business" className="mt-3 inline-block text-xs font-semibold text-[var(--brand)] hover:underline">
                Open dashboard
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {["Station", "Plan", "Monthly", "Products", "Status", ""].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted font-display text-xs text-foreground">
                        {r.name.slice(0, 1)}
                      </span>
                      <div>
                        <p className="font-semibold text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{r.area}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={PLAN_TONE[r.plan]}>{planLabel(r.plan)}</Badge>
                  </td>
                  <td className="px-5 py-4 font-medium text-foreground">{formatKES(r.monthly)}</td>
                  <td className="px-5 py-4 text-foreground/85">{r.products}</td>
                  <td className="px-5 py-4">
                    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", r.verified ? "text-success" : "text-warning")}>
                      <span className={cn("size-1.5 rounded-full", r.verified ? "bg-success" : "bg-warning")} />
                      {r.verified ? "Live" : "Pending"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link href="/business" className="text-xs font-semibold text-[var(--brand)] hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AnimatedSection>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AnimatedSection className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
            <BadgeCheck className="size-5 text-foreground" aria-hidden /> Subscription mix
          </h2>
          <ul className="mt-5 space-y-4">
            {(["pro", "growth", "starter"] as PlanId[]).map((planId) => {
              const value = ROWS.filter((r) => r.plan === planId).length;
              return (
                <li key={planId}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{planLabel(planId)}</span>
                    <span className="font-mono text-xs text-muted-foreground">{value} stations</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", planId === "pro" ? "bg-foreground" : planId === "growth" ? "bg-[var(--brand-bright)]" : "bg-[var(--brand)]/40")}
                      style={{ width: `${ROWS.length ? (value / ROWS.length) * 100 : 0}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
            <MapPin className="size-5 text-foreground" aria-hidden /> Coverage
          </h2>
          <ul className="mt-5 flex flex-wrap gap-2">
            {[...new Set(businesses.map((b) => b.city))].map((city) => (
              <li key={city} className="rounded-lg bg-muted px-3 py-1.5 text-xs text-foreground">
                {city}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
            {businesses.length} stations across {cityCount} cities, each with its own products, prices
            and delivery fee.
          </p>
        </AnimatedSection>
      </div>
    </Container>
  );
}
