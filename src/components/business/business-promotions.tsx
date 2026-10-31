"use client";

import { useState } from "react";
import { PartyPopper, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const PROMOS = [
  { id: "pr1", name: "Karibu tena - KES 50 off", audience: "Dormant (30d+)", discount: "KES 50 off any order", ends: "This Friday", active: true, recipients: 14, redeemed: 6 },
  { id: "pr2", name: "Ode office days", audience: "Office addresses", discount: "2nd can free on 20L refills", ends: "All month", active: true, recipients: 22, redeemed: 9 },
  { id: "pr3", name: "Weekend chilled deal", audience: "All customers", discount: "10L chilled at KES 150", ends: "Ended", active: false, recipients: 310, redeemed: 47 },
];

export function BusinessPromotions() {
  const [promos, setPromos] = useState(PROMOS);
  const [note, setNote] = useState<string | null>(null);

  const toggle = (id: string) => {
    setPromos((all) => all.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
    setNote("Promotion status toggled - customers see the change in their app instantly.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">Promotions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reach the right neighbours with discounts that land as M-Pesa reminders.
          </p>
        </div>
        <Button
          className="group"
          onClick={() => setNote("Draft started - choose an audience and an offer, then review pricing math.")}
        >
          <PartyPopper className="size-4" aria-hidden /> New promotion
        </Button>
      </div>

      {note && (
        <div role="status" className="flex items-center justify-between rounded-xl border border-[var(--brand)]/25 bg-brand/5 px-4 py-3 text-sm text-[var(--brand)]">
          {note}
          <button onClick={() => setNote(null)} className="font-semibold" aria-label="Dismiss">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {promos.map((p) => (
          <article key={p.id} className={cn("rounded-2xl border bg-white p-5 shadow-card", p.active ? "border-border" : "border-border opacity-60")}>
            <div className="flex items-start justify-between gap-2">
              <Badge variant={p.active ? "accent" : "muted"}>{p.active ? "Live" : "Paused / ended"}</Badge>
              <span className="font-mono text-[11px] text-muted-foreground">ends {p.ends}</span>
            </div>
            <h2 className="mt-3 font-display text-lg text-foreground">{p.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.discount}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-foreground/70">
              <Users2 className="size-3.5 text-[var(--brand)]" aria-hidden /> Target: {p.audience}
            </p>
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Sent to {p.recipients}</span>
                <span>
                  Redeemed <strong className="text-foreground">{p.redeemed}</strong>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground" style={{ width: `${(p.redeemed / Math.max(p.recipients, 1)) * 100}%` }} />
              </div>
            </div>
            <button
              onClick={() => toggle(p.id)}
              className="mt-4 w-full rounded-xl border border-[var(--brand)]/30 py-2 text-sm font-semibold text-[var(--brand)] transition-colors hover:bg-brand/5"
            >
              {p.active ? "Pause" : "Reactivate"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}