"use client";

import { useState } from "react";
import { Bell, Clock, MapPin, Save, Smartphone, Store, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { formatKES } from "@/lib/format";
import { weeklyHoursGrid } from "@/lib/business-hours";
import { useBusiness } from "@/components/business/business-provider";
import { cn } from "@/lib/utils";

/**
 * Settings shows the station's published record and how orders reach you.
 * Notification preferences are saved per browser.
 */

const NOTIFY_KEY = "mf:notifications";

interface NotifyPrefs {
  orders: boolean;
  sms: boolean;
  daily: boolean;
  stock: boolean;
}

const DEFAULT_NOTIFY: NotifyPrefs = { orders: true, sms: false, daily: true, stock: true };

function readNotify(): NotifyPrefs {
  try {
    const raw = window.localStorage.getItem(NOTIFY_KEY);
    if (!raw) return DEFAULT_NOTIFY;
    const parsed = JSON.parse(raw) as Partial<NotifyPrefs>;
    return { ...DEFAULT_NOTIFY, ...parsed };
  } catch {
    return DEFAULT_NOTIFY;
  }
}

export function BusinessSettings() {
  const { business } = useBusiness();
  const [notify, setNotify] = useState<NotifyPrefs>(readNotify);
  const hours = weeklyHoursGrid(business.openingHours);

  const setPref = (key: keyof NotifyPrefs) => {
    setNotify((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        window.localStorage.setItem(NOTIFY_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-foreground sm:text-3xl">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            What customers see for <strong className="text-foreground">{business.name}</strong>, plus how orders reach
            you.
          </p>
        </div>
        <Button
          className="gap-2"
          disabled
          title="Station details are managed by MajiFlow support"
        >
          <Save className="size-4" aria-hidden /> Save changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Profile */}
        <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
              <Store className="size-5 text-[var(--brand)]" aria-hidden /> Business profile
            </h2>
            <Badge variant="muted">Read only</Badge>
          </div>
          <div className="mt-5 space-y-5">
            <Field label="Business name">
              <Input value={business.name} readOnly />
            </Field>
            <Field label="Tagline" hint="Shown under your name on search and your public page.">
              <Input value={business.tagline} readOnly />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="City">
                <Input value={business.city} readOnly />
              </Field>
              <Field label="Delivery areas" hint="The estates you deliver to.">
                <Input value={business.estates.join(", ")} readOnly />
              </Field>
            </div>
            <Field label="About your station">
              <Textarea rows={4} readOnly value={business.description} />
            </Field>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            These details come from your station record and are shown to customers on your page.
            Contact support to update them.
          </p>
        </section>

        <div className="flex flex-col gap-6">
          {/* Hours */}
          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
              <Clock className="size-5 text-[var(--brand)]" aria-hidden /> Operating hours
            </h2>
            <ul className="mt-4 space-y-2">
              {hours.map((h) => (
                <li key={h.day} className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{h.short}</span>
                  <span className={cn("text-sm font-semibold", h.label.startsWith("Not") ? "text-muted-foreground" : "text-foreground")}>
                    {h.label}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              These are the hours used to check whether your station can take an order right now.
            </p>
          </section>

          {/* Notifications */}
          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
              <Bell className="size-5 text-[var(--brand)]" aria-hidden /> Notifications
            </h2>
            <ul className="mt-4 space-y-3">
              {(
                [
                  { key: "orders", label: "New order alerts", desc: "Sound + banner on every order" },
                  { key: "sms", label: "SMS to customers", desc: "Accepted, on the way, delivered" },
                  { key: "daily", label: "Daily summary", desc: "7am revenue + orders digest" },
                  { key: "stock", label: "Low stock reminders", desc: "When inventory dips below threshold" },
                ] as const
              ).map((n) => (
                <li key={n.key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{n.label}</p>
                    <p className="text-xs text-muted-foreground">{n.desc}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={notify[n.key]}
                    aria-label={n.label}
                    onClick={() => setPref(n.key)}
                    className={cn(
                      "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                      notify[n.key] ? "bg-foreground" : "bg-muted-foreground/30"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
                        notify[n.key] ? "translate-x-[22px]" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Choose which updates you receive. These preferences are saved to your account.
            </p>
          </section>
        </div>
      </div>

      {/* Delivery */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
        <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
          <Truck className="size-5 text-[var(--brand)]" aria-hidden /> Delivery & fees
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          <Field label="Flat delivery fee">
            <Input value={formatKES(business.deliveryFee)} readOnly />
          </Field>
          <Field label="Free delivery above">
            <Input value={formatKES(business.freeDeliveryAbove)} readOnly />
          </Field>
          <Field label="Typical delivery time">
            <Input value={`${business.avgDeliveryMinutes} minutes`} readOnly />
          </Field>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Areas served</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {business.estates.map((estate) => (
              <li key={estate} className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs text-foreground">
                <MapPin className="size-3" aria-hidden /> {estate}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Per-area fees and delivery windows are managed per estate. The flat fee above is what
          checkout charges by default.
        </p>
      </section>

      {/* Payments */}
      <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
            <Smartphone className="size-5 text-[var(--brand)]" aria-hidden /> Payment methods
          </h2>
        </div>
        <ul className="mt-5 space-y-3">
          <li className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="text-sm font-medium text-foreground">M-Pesa at checkout</span>
            <Badge variant={business.acceptsMpesa ? "success" : "muted"}>
              {business.acceptsMpesa ? "Enabled" : "Not offered"}
            </Badge>
          </li>
          <li className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <span className="text-sm font-medium text-foreground">Pay on delivery</span>
            <Badge variant="success">Enabled</Badge>
          </li>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Pay-on-delivery money is collected by your rider or at your counter. An order paid on
          delivery is marked paid when it is marked delivered.
        </p>
      </section>
    </div>
  );
}
