"use client";

import { useMemo, useState } from "react";
import { Download, Mail, MapPin, Phone, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { formatKES } from "@/lib/format";
import { filterCustomers } from "@/lib/analytics";
import { DORMANT_AFTER_DAYS } from "@/lib/analytics";
import { useBusiness } from "@/components/business/business-provider";
import { useStationOrders } from "@/lib/use-station-orders";
import { cn } from "@/lib/utils";
import type { StationCustomer } from "@/lib/analytics";

type Segment = "all" | StationCustomer["status"];

const TABS: { id: Segment; label: string }[] = [
  { id: "all", label: "All customers" },
  { id: "active", label: "Active" },
  { id: "new", label: "New" },
  { id: "dormant", label: "Dormant" },
];

export function BusinessCustomers() {
  const { business } = useBusiness();
  const { stats, loading, error, refresh } = useStationOrders(business, "all");
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Segment>("all");

  const filtered = useMemo(
    () => (stats ? filterCustomers(stats.customers, { query: q, segment: tab }) : []),
    [stats, q, tab]
  );

  const tabs = useMemo(
    () =>
      TABS.map((t) => ({
        ...t,
        count: stats ? filterCustomers(stats.customers, { segment: t.id }).length : 0,
      })),
    [stats]
  );

  const exportCsv = () => {
    const header = ["Name", "Phone", "Area", "Orders", "Total spent", "Last order", "Status"];
    const rows = filtered.map((c) => [
      c.name,
      c.phone,
      c.location,
      String(c.orders),
      String(c.totalSpent),
      c.lastOrder,
      c.status,
    ]);
    const csv = [header, ...rows]
      .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${business.slug}-customers.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({
      kind: "success",
      title: "CSV downloaded",
      message: `${filtered.length} ${filtered.length === 1 ? "customer" : "customers"} from this station.`,
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header onExport={exportCsv} exportable={false} />
        <LoadingState label="Loading your customers…" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="space-y-6">
        <Header onExport={exportCsv} exportable={false} />
        <ErrorState
          title="Could not load customers"
          message="The order store did not answer. Your customer list is built from your orders, so it will return with them."
          action={<Button onClick={refresh}>Try again</Button>}
        />
      </div>
    );
  }

  const noCustomers = stats.customers.length === 0;

  return (
    <div className="space-y-6">
      <Header onExport={exportCsv} exportable={filtered.length > 0} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 sm:max-w-md">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, or area"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            aria-label="Search customers"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
                tab === t.id ? "bg-brand/10 text-[var(--brand)]" : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={tab === t.id}
            >
              {t.label}
              <span className="ml-1.5 font-mono text-xs text-muted-foreground">{t.count}</span>
            </button>
          ))}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-card">
        {noCustomers ? (
          <div className="p-6">
            <EmptyState
              icon={<Users className="size-6" aria-hidden />}
              title="No customers yet"
              description="Every phone number that checks out on your public page lands here with its order history."
            />
          </div>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No customers match that search. Clear the box or pick another segment.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4 hover:bg-muted/30">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted font-display text-sm text-foreground">
                  {c.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                    <Badge variant={c.status === "active" ? "success" : c.status === "new" ? "softAccent" : "muted"}>
                      {c.status}
                    </Badge>
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" aria-hidden /> {c.phone}
                    </span>
                    {c.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden /> {c.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" aria-hidden /> last order{" "}
                      {new Date(c.lastOrder).toLocaleDateString("en-KE", { dateStyle: "medium" })}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-base text-foreground">{formatKES(c.totalSpent)}</p>
                  <p className="text-xs text-muted-foreground">{c.orders} orders</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {filtered.some((c) => c.status === "dormant") && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/25 bg-warning/10 p-5">
          <Users className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm leading-relaxed text-foreground/85">
            {filtered.filter((c) => c.status === "dormant").length} of these customers last ordered more than{" "}
            {DORMANT_AFTER_DAYS} days ago. Export the list to work through them by phone or SMS.
          </p>
        </div>
      )}
    </div>
  );
}

function Header({ onExport, exportable }: { onExport: () => void; exportable: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl text-foreground sm:text-3xl">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Built from your orders: one row per phone number that has checked out with you.
        </p>
      </div>
      <Button variant="secondary" className="gap-2" onClick={onExport} disabled={!exportable}>
        <Download className="size-4" aria-hidden /> Export CSV
      </Button>
    </div>
  );
}
