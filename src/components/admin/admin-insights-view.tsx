import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Building2,
  ClipboardCheck,
  Download,
  Package,
  Radio,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { buttonVariants } from "@/components/ui/button";
import { DailyBarChart } from "@/components/admin/daily-bar-chart";
import { formatKES } from "@/lib/format";
import { INSIGHT_RANGES, STATION_STATE_LABEL, STATION_STATES } from "@/lib/admin-console";
import type { PlatformInsights } from "@/lib/server/admin-insights";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  preparing: "Preparing",
  rider_assigned: "Rider assigned",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function percent(part: number, whole: number) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

/** Change against the previous period of the same length, or null when there is nothing to compare. */
function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function Delta({ value, days }: { value: number | null; days: number }) {
  if (value === null) return <span className="text-muted-foreground">No earlier data</span>;
  const up = value >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium", up ? "text-success" : "text-danger")}>
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : ""}
      {value}% <span className="font-normal text-muted-foreground">vs previous {days} days</span>
    </span>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  footer,
  tone = "brand",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  footer: React.ReactNode;
  tone?: "brand" | "warning";
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg",
            tone === "warning" ? "bg-warning-soft text-warning" : "bg-cta-soft text-[var(--brand)]"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 font-display text-3xl text-foreground">{value}</p>
      <p className="mt-auto pt-2 text-xs">{footer}</p>
    </div>
  );
}

function Panel({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6", className)}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg text-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A labelled share bar: label and value as text, the bar only reinforces them. */
function ShareRow({ label, value, total, hint }: { label: string; value: number; total: number; hint?: string }) {
  const share = percent(value, total);
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="font-mono text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{value.toLocaleString("en-KE")}</span>
          {hint ?? (total ? ` · ${share}%` : "")}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${share}%` }} />
      </div>
    </li>
  );
}

export function AdminInsightsView({ insights }: { insights: PlatformInsights }) {
  const { summary, stations, users } = insights;
  const days = summary.days;
  const closed = summary.byStatus.delivered + summary.byStatus.rejected + summary.byStatus.cancelled;
  const hasOrders = summary.orders > 0;
  const updated = new Date(insights.generatedAt).toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi",
  });

  return (
    <Container className="py-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Orders, stations and customers across MajiFlow. Updated {updated} EAT.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Date range" className="inline-flex rounded-xl border border-border bg-card p-1">
            {INSIGHT_RANGES.map((range) => (
              <Link
                key={range}
                href={range === 30 ? "/admin" : `/admin?days=${range}`}
                aria-current={range === days ? "true" : undefined}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  range === days ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {range} days
              </Link>
            ))}
          </div>
          <a
            href={`/api/admin/export?kind=orders&days=${days}`}
            className={buttonVariants({ variant: "secondary", size: "sm", className: "gap-2" })}
          >
            <Download className="size-4" aria-hidden /> Orders CSV
          </a>
        </div>
      </div>

      {(insights.pendingApplications > 0 || stations.hidden > 0 || summary.cashToCollectOrders > 0) && (
        <ul className="mt-6 grid gap-3 md:grid-cols-3">
          {insights.pendingApplications > 0 && (
            <li>
              <Link href="/admin/applications" className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground hover:border-warning">
                <ClipboardCheck className="size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <strong>{insights.pendingApplications}</strong> business application{insights.pendingApplications === 1 ? "" : "s"} waiting for review
                </span>
              </Link>
            </li>
          )}
          {stations.hidden > 0 && (
            <li>
              <Link href="/admin/stations?state=hidden" className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground hover:border-warning">
                <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <strong>{stations.hidden}</strong> published station{stations.hidden === 1 ? " is" : "s are"} not visible to customers
                </span>
              </Link>
            </li>
          )}
          {summary.cashToCollectOrders > 0 && (
            <li>
              <Link href="/admin/orders" className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground hover:border-[var(--brand)]">
                <Wallet className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
                <span>
                  <strong>{formatKES(summary.cashToCollect)}</strong> to collect on {summary.cashToCollectOrders} open pay-on-delivery order{summary.cashToCollectOrders === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          )}
        </ul>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={ShoppingBag}
          label="Orders"
          value={summary.orders.toLocaleString("en-KE")}
          footer={<Delta value={change(summary.orders, summary.previousOrders)} days={days} />}
        />
        <Kpi
          icon={Banknote}
          label="Delivered value"
          value={formatKES(summary.deliveredValue)}
          footer={<Delta value={change(summary.deliveredValue, summary.previousDeliveredValue)} days={days} />}
        />
        <Kpi
          icon={Truck}
          label="Delivered"
          value={`${percent(summary.byStatus.delivered, closed)}%`}
          footer={
            <span className="text-muted-foreground">
              {summary.delivered} of {closed} finished orders · avg {formatKES(summary.averageOrderValue)}
            </span>
          }
        />
        <Kpi
          icon={Users}
          label="New customers"
          value={users.newCustomers.toLocaleString("en-KE")}
          footer={<Delta value={change(users.newCustomers, users.previousNewCustomers)} days={days} />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Orders per day">
          <DailyBarChart title="Orders" unit="orders" kind="count" points={summary.daily.map((d) => ({ date: d.date, value: d.orders }))} />
        </Panel>
        <Panel title="Delivered value per day">
          <DailyBarChart title="Delivered value" unit="shillings" kind="money" points={summary.daily.map((d) => ({ date: d.date, value: d.value }))} />
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel
          title="Top stations"
          className="lg:col-span-2"
          action={
            <Link href="/admin/stations" className="text-sm font-semibold text-[var(--brand)] hover:underline">
              All stations
            </Link>
          }
        >
          {summary.topStations.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Station</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Orders</th>
                    <th scope="col" className="py-2 pr-3 text-right font-medium">Delivered value</th>
                    <th scope="col" className="py-2 text-right font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topStations.map((s) => (
                    <tr key={s.businessId} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3 font-medium text-foreground">{s.name}</td>
                      <td className="py-2.5 pr-3 text-right font-mono">{s.orders}</td>
                      <td className="py-2.5 pr-3 text-right font-mono">{formatKES(s.deliveredValue)}</td>
                      <td className="py-2.5 text-right font-mono text-muted-foreground">{percent(s.deliveredValue, summary.deliveredValue)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No orders in the last {days} days.</p>
          )}
        </Panel>

        <Panel title="Payment method">
          {hasOrders ? (
            <ul className="space-y-4">
              <ShareRow label="Pay on delivery" value={summary.byPayment.cod} total={summary.orders} />
              <ShareRow label="M-Pesa (online)" value={summary.byPayment.mpesa} total={summary.orders} />
              {summary.byPayment.other > 0 && <ShareRow label="Other" value={summary.byPayment.other} total={summary.orders} />}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No orders in the last {days} days.</p>
          )}
          <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{summary.activeNow}</span> order{summary.activeNow === 1 ? "" : "s"} in progress right now.{" "}
            <Link href="/admin/orders" className="inline-flex items-center gap-1 font-semibold text-[var(--brand)] hover:underline">
              <Radio className="size-3.5" aria-hidden /> Live orders
            </Link>
          </p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Order outcomes">
          {hasOrders ? (
            <ul className="space-y-3">
              {(Object.keys(STATUS_LABEL) as OrderStatus[])
                .filter((s) => summary.byStatus[s] > 0)
                .map((s) => (
                  <ShareRow key={s} label={STATUS_LABEL[s]} value={summary.byStatus[s]} total={summary.orders} />
                ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No orders in the last {days} days.</p>
          )}
          {closed > 0 && (
            <p className="mt-4 text-xs text-muted-foreground">
              {Math.round(summary.failedRate * 100)}% of finished orders were rejected or cancelled.
            </p>
          )}
        </Panel>

        <Panel
          title="Stations"
          action={
            <Link href="/admin/stations" className="text-sm font-semibold text-[var(--brand)] hover:underline">
              Manage
            </Link>
          }
        >
          <p className="font-display text-3xl text-foreground">
            {stations.live}
            <span className="ml-2 text-sm font-normal text-muted-foreground">live of {stations.total}</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {STATION_STATES.filter((s) => s !== "live").map((state) => (
              <li key={state} className="flex justify-between">
                <Link href={`/admin/stations?state=${state}`} className="text-muted-foreground hover:text-foreground">
                  {STATION_STATE_LABEL[state]}
                </Link>
                <span className="font-mono text-foreground">{stations[state]}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
            <Building2 className="size-4" aria-hidden />
            {insights.paidStations} paying · {formatKES(insights.monthlyRecurringRevenue)}/month
          </p>
        </Panel>

        <Panel
          title="People"
          action={
            <Link href="/admin/users" className="text-sm font-semibold text-[var(--brand)] hover:underline">
              Manage
            </Link>
          }
        >
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-muted-foreground">Customers</dt>
              <dd className="font-display text-2xl text-foreground">{users.customers.toLocaleString("en-KE")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Station owners</dt>
              <dd className="font-display text-2xl text-foreground">{users.owners.toLocaleString("en-KE")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Ordered in {days} days</dt>
              <dd className="font-display text-2xl text-foreground">{summary.customers.toLocaleString("en-KE")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Orders per customer</dt>
              <dd className="font-display text-2xl text-foreground">
                {summary.customers ? (summary.orders / summary.customers).toFixed(1) : "–"}
              </dd>
            </div>
          </dl>
          <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
            <Package className="size-3.5" aria-hidden />
            &ldquo;Ordered&rdquo; counts guests by phone number too.
          </p>
        </Panel>
      </div>
    </Container>
  );
}
