"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Package, Repeat, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { formatKES } from "@/lib/format";
import { DATE_RANGES, percentChange, type DateRangeId } from "@/lib/analytics";
import { useBusiness } from "@/components/business/business-provider";
import { useStationOrders } from "@/lib/use-station-orders";
import { cn } from "@/lib/utils";

export function BusinessAnalytics() {
  const { business } = useBusiness();
  const [rangeId, setRangeId] = useState<DateRangeId>("30d");
  const { stats, loading, delayed, error, refresh, range } = useStationOrders(business, rangeId);

  const maxRevenue = useMemo(() => Math.max(1, ...(stats?.buckets.map((b) => b.revenue) ?? [1])), [stats]);
  const productRevenue = useMemo(() => stats?.topProducts.reduce((sum, p) => sum + p.revenue, 0) ?? 0, [stats]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Header rangeId={rangeId} setRangeId={setRangeId} />
        <LoadingState label="Loading your station's numbers…" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <Header rangeId={rangeId} setRangeId={setRangeId} />
        <ErrorState
          title="Could not load analytics"
          message="The order store did not answer, so these numbers cannot be shown. Your orders are unaffected."
          action={
            <Button onClick={refresh}>Try again</Button>
          }
        />
      </div>
    );
  }

  const empty = stats.orderCount === 0;

  return (
    <div className="space-y-6">
      <Header rangeId={rangeId} setRangeId={setRangeId} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label={`Revenue · ${range.label.toLowerCase()}`}
          value={formatKES(stats.revenue)}
          delta={deltaLabel(stats.revenue, stats.previous?.revenue ?? null)}
        />
        <StatCard
          icon={Package}
          label={`Orders · ${range.label.toLowerCase()}`}
          value={String(stats.orderCount)}
          delta={deltaLabel(stats.orderCount, stats.previous?.orders ?? null)}
        />
        <StatCard
          icon={Repeat}
          label="Repeat customers"
          value={`${stats.repeatRate}%`}
          delta="of customers who ordered in this window"
        />
        <StatCard
          icon={Users}
          label="New customers"
          value={String(stats.newCustomers)}
          delta="first ever order in this window"
        />
      </div>

      {delayed && (
        <p role="status" className="text-xs text-muted-foreground">
          These totals are from the last successful refresh.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-foreground">Revenue trend</h2>
            <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" aria-hidden /> {range.label} · {grainLabel(range.grain)}
            </span>
          </div>
          {stats.buckets.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No orders in {range.label.toLowerCase()}, so there is nothing to chart. Pick a wider range above.
            </p>
          ) : (
            <div className="mt-8 flex h-52 items-end gap-3 sm:gap-4">
              {stats.buckets.map((c) => (
                <div key={c.key} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-foreground opacity-90 group-hover:opacity-100"
                      style={{ height: `${(c.revenue / maxRevenue) * 100}%` }}
                    />
                    <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 font-mono text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {formatKES(c.revenue)}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{c.label}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground">
            {formatKES(stats.deliveryRevenue)} of delivery fees collected in this window · average order{" "}
            {formatKES(stats.avgOrderValue)}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
          <h2 className="font-display text-lg text-foreground">Order mix</h2>
          {stats.topProducts.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">No products sold in this window.</p>
          ) : (
            <ul className="mt-5 space-y-4">
              {stats.topProducts.map((p) => {
                const pct = productRevenue ? Math.round((p.revenue / productRevenue) * 100) : 0;
                return (
                  <li key={p.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                      {p.quantity} sold · {formatKES(p.revenue)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-6 rounded-xl bg-muted/50 p-4 text-xs leading-relaxed text-muted-foreground">
            Counted from orders that were not rejected or cancelled. Hourly heatmaps, delivery zones
            and staff performance are coming soon.
          </p>
        </section>
      </div>

      {empty && (
        <EmptyState
          title={`No orders in ${range.label.toLowerCase()}`}
          description="Widen the range above, or share your public page to get your first order."
        />
      )}

      <p className="text-center text-xs text-muted-foreground">
        {stats.orderCount} orders · {stats.customers.length} customers on record · buckets are cut in{" "}
        {business.city} local time
      </p>
    </div>
  );
}

function Header({
  rangeId,
  setRangeId,
}: {
  rangeId: DateRangeId;
  setRangeId: (id: DateRangeId) => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl text-foreground sm:text-3xl">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every number below is counted from this station&apos;s orders.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
        {DATE_RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRangeId(r.id)}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              rangeId === r.id ? "bg-brand/10 text-[var(--brand)]" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
            aria-pressed={rangeId === r.id}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-[var(--brand)]">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <p className="mt-3 font-display text-2xl text-foreground">{value}</p>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[11px] text-muted-foreground/80">{delta}</p>
    </div>
  );
}

function deltaLabel(current: number, baseline: number | null): string {
  if (baseline === null) return "no earlier window to compare";
  const change = percentChange(current, baseline);
  if (change === null) return "nothing in the earlier window";
  return `${change > 0 ? "+" : ""}${change}% vs earlier window`;
}

function grainLabel(grain: "hour" | "day" | "month"): string {
  if (grain === "hour") return "by hour";
  if (grain === "month") return "by month";
  return "by day";
}
