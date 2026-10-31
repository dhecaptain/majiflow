"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Download, ExternalLink, Mail, Phone, Search } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/field";
import { STATION_STATE_LABEL, STATION_STATES, type StationState } from "@/lib/admin-console";
import { formatKES, formatRelativeTime } from "@/lib/format";
import type { AdminStation } from "@/lib/server/admin-insights";
import { cn } from "@/lib/utils";

const STATE_TONE: Record<StationState, string> = {
  live: "bg-success-soft text-success",
  hidden: "bg-warning-soft text-warning",
  ready: "bg-cta-soft text-[var(--brand)]",
  setup: "bg-muted text-muted-foreground",
  suspended: "bg-danger-soft text-danger",
};

type Filter = "all" | StationState;

function StatePill({ state }: { state: StationState }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", STATE_TONE[state])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {STATION_STATE_LABEL[state]}
    </span>
  );
}

function planLabel(station: AdminStation) {
  if (!station.plan || station.subscriptionStatus === "none") return "No plan";
  const plan = station.plan[0].toUpperCase() + station.plan.slice(1);
  if (station.paid) return `${plan} · paid`;
  if (station.subscriptionStatus === "trialing") return `${plan} · trial`;
  return `${plan} · ${station.subscriptionStatus.replace("_", " ")}`;
}

export function AdminStations({
  stations,
  initialState,
  initialQuery = "",
}: {
  stations: AdminStation[];
  initialState: Filter;
  initialQuery?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(initialState);
  const [q, setQ] = useState(initialQuery);
  const [target, setTarget] = useState<AdminStation | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result = { all: stations.length } as Record<Filter, number>;
    for (const state of STATION_STATES) result[state] = stations.filter((s) => s.state === state).length;
    return result;
  }, [stations]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return stations.filter(
      (s) =>
        (filter === "all" || s.state === filter) &&
        (!needle ||
          [s.name, s.city, s.area, s.ownerName, s.ownerEmail ?? "", s.ownerPhone ?? "", s.phone].some((v) =>
            v.toLowerCase().includes(needle)
          ))
    );
  }, [stations, filter, q]);

  const close = () => {
    setTarget(null);
    setReason("");
    setError(null);
  };

  const submit = async () => {
    if (!target) return;
    const suspend = target.state !== "suspended";
    if (suspend && !reason.trim()) {
      setError("Give a reason. The owner will need to know why.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/stations/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suspended: suspend, reason }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Could not update the station.");
        return;
      }
      setNotice(suspend ? `${target.name} is suspended and hidden from customers.` : `${target.name} is reinstated.`);
      close();
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container className="py-8 lg:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-foreground sm:text-4xl">Stations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every station on MajiFlow, whatever its state. Suspending one takes it off browse and checkout at once.
          </p>
        </div>
        <a href="/api/admin/export?kind=stations" className={buttonVariants({ variant: "secondary", size: "sm", className: "gap-2" })}>
          <Download className="size-4" aria-hidden /> Stations CSV
        </a>
      </div>

      {notice && (
        <div role="status" className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand)]/5 px-4 py-3 text-sm text-foreground">
          {notice}
          <button type="button" onClick={() => setNotice(null)} className="font-semibold text-[var(--brand)]">
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by state">
          {(["all", ...STATION_STATES] as Filter[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={cn(
                "shrink-0 rounded-xl border px-3.5 py-1.5 text-sm font-medium transition-colors",
                filter === id
                  ? "border-[var(--brand)] bg-brand/10 text-[var(--brand)]"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              {id === "all" ? "All" : STATION_STATE_LABEL[id]}
              <span className="ml-2 font-mono text-xs">{counts[id]}</span>
            </button>
          ))}
        </div>
        <label className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:w-72">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">Search stations</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, city, owner or phone"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        {shown.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title={stations.length ? "No stations match" : "No stations yet"}
              description={
                stations.length
                  ? "Try another filter or search."
                  : "Approved business applications appear here as stations."
              }
              action={
                !stations.length ? (
                  <Link href="/admin/applications" className={buttonVariants({ size: "sm" })}>
                    Review applications
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Phones: cards */}
            <ul className="divide-y divide-border lg:hidden">
              {shown.map((s) => (
                <li key={s.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{s.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.city} · {s.ownerName}</p>
                    </div>
                    <StatePill state={s.state} />
                  </div>
                  {s.issues.length > 0 && <p className="mt-2 text-xs text-warning">{s.issues.join(" · ")}</p>}
                  {s.suspensionReason && <p className="mt-2 text-xs text-danger">Suspended: {s.suspensionReason}</p>}
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Orders 30d</dt>
                      <dd className="font-mono text-foreground">{s.orders30d}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Delivered 30d</dt>
                      <dd className="font-mono text-foreground">{formatKES(s.deliveredValue30d, { compact: true })}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Products</dt>
                      <dd className="font-mono text-foreground">{s.visibleProducts}/{s.products}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{planLabel(s)}</span>
                    <StationActions station={s} onModerate={setTarget} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Larger screens: table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th scope="col" className="px-5 py-3 font-medium">Station</th>
                    <th scope="col" className="px-3 py-3 font-medium">State</th>
                    <th scope="col" className="px-3 py-3 font-medium">Owner</th>
                    <th scope="col" className="px-3 py-3 font-medium">Plan</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Products</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Orders 30d</th>
                    <th scope="col" className="px-3 py-3 text-right font-medium">Delivered 30d</th>
                    <th scope="col" className="px-3 py-3 font-medium">Last order</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id} className="border-b border-border align-top last:border-0 hover:bg-muted/30">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.area}, {s.city}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <StatePill state={s.state} />
                        {s.issues.length > 0 && <p className="mt-1 max-w-56 text-xs text-warning">{s.issues.join(" · ")}</p>}
                        {s.suspensionReason && <p className="mt-1 max-w-56 text-xs text-danger">{s.suspensionReason}</p>}
                      </td>
                      <td className="px-3 py-3.5">
                        <p className="text-foreground">{s.ownerName}</p>
                        <div className="mt-0.5 flex gap-2 text-muted-foreground">
                          {s.ownerPhone && (
                            <a href={`tel:${s.ownerPhone}`} aria-label={`Call ${s.ownerName}`} className="hover:text-foreground">
                              <Phone className="size-3.5" aria-hidden />
                            </a>
                          )}
                          {s.ownerEmail && (
                            <a href={`mailto:${s.ownerEmail}`} aria-label={`Email ${s.ownerName}`} className="hover:text-foreground">
                              <Mail className="size-3.5" aria-hidden />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-muted-foreground">
                        {planLabel(s)}
                        {s.monthlyFee > 0 && <p className="text-xs">{formatKES(s.monthlyFee)}/mo</p>}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono">{s.visibleProducts}<span className="text-muted-foreground">/{s.products}</span></td>
                      <td className="px-3 py-3.5 text-right font-mono">{s.orders30d}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-right font-mono">{formatKES(s.deliveredValue30d)}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-muted-foreground">{s.lastOrderAt ? formatRelativeTime(s.lastOrderAt) : "Never"}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-3 text-xs">
                          <StationActions station={s} onModerate={setTarget} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <Dialog
        open={Boolean(target)}
        onClose={close}
        title={target?.state === "suspended" ? `Reinstate ${target?.name}?` : `Suspend ${target?.name ?? "station"}?`}
        description={
          target?.state === "suspended"
            ? "The station returns to browse as soon as it meets the listing rules again."
            : "The station disappears from browse and cannot take new orders. Orders already placed carry on."
        }
      >
        {target && target.state !== "suspended" && (
          <Field label="Reason" hint="Kept on record and shown in this console." error={error ?? undefined} required>
            <Textarea
              data-autofocus
              rows={3}
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Water quality certificate expired"
            />
          </Field>
        )}
        {target?.state === "suspended" && error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={busy}
            data-autofocus={target?.state === "suspended" ? true : undefined}
            className={target?.state === "suspended" ? undefined : "bg-danger text-white hover:bg-danger/90"}
          >
            {busy ? "Saving…" : target?.state === "suspended" ? "Reinstate" : "Suspend station"}
          </Button>
        </div>
      </Dialog>
    </Container>
  );
}

function StationActions({ station, onModerate }: { station: AdminStation; onModerate: (s: AdminStation) => void }) {
  return (
    <>
      {station.state === "live" && (
        <Link
          href={`/browse/${station.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1 font-semibold text-[var(--brand)] hover:underline"
        >
          View <ExternalLink className="size-3" aria-hidden />
        </Link>
      )}
      <button
        type="button"
        onClick={() => onModerate(station)}
        className={cn("font-semibold hover:underline", station.state === "suspended" ? "text-success" : "text-danger")}
      >
        {station.state === "suspended" ? "Reinstate" : "Suspend"}
      </button>
    </>
  );
}
