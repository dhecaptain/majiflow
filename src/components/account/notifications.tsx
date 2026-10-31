"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, CheckCheck, CheckCircle2, Clock, Truck, XCircle } from "lucide-react";
import { Container } from "@/components/ui/container";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { AccountError, AccountPageHeader, useAccountResource } from "@/components/account/account-ui";
import { accountApi } from "@/lib/account-client";
import type { CustomerPreferences } from "@/lib/account";
import { formatKES, formatRelativeTime } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_META: Record<OrderStatus, { label: string; icon: typeof Clock }> = {
  pending: { label: "Order placed", icon: Clock },
  accepted: { label: "Order accepted", icon: CheckCircle2 },
  preparing: { label: "Being prepared", icon: Clock },
  rider_assigned: { label: "Rider assigned", icon: Truck },
  out_for_delivery: { label: "Out for delivery", icon: Truck },
  delivered: { label: "Delivered", icon: CheckCircle2 },
  rejected: { label: "Order rejected", icon: XCircle },
  cancelled: { label: "Order cancelled", icon: XCircle },
};

type PreferenceKey = "orderUpdates" | "marketing";

const PREFERENCES: { key: PreferenceKey; title: string; description: string }[] = [
  {
    key: "orderUpdates",
    title: "Order status messages",
    description: "SMS when a station accepts, dispatches or delivers your order.",
  },
  {
    key: "marketing",
    title: "Offers and refill reminders",
    description: "Let us contact you about deals and refill reminders from stations you use.",
  },
];

function PreferenceToggle({
  title,
  description,
  checked,
  busy,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  busy: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={busy}
          aria-busy={busy}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden
          className="h-7 w-12 rounded-full bg-muted transition-colors peer-checked:bg-[var(--brand)] peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:opacity-60"
        />
        <span
          aria-hidden
          className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5"
        />
      </span>
    </label>
  );
}

export function NotificationsPage() {
  const { toast } = useToast();
  const { resource, reload, replace } = useAccountResource("notifications", accountApi.notifications);
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);
  const [marking, setMarking] = useState(false);

  const data = resource.status === "ready" ? resource.data : null;
  const readAt = data?.preferences.notificationsReadAt ? Date.parse(data.preferences.notificationsReadAt) : 0;

  const withPreferences = (preferences: CustomerPreferences, unread = data?.unread ?? 0) => {
    if (data) replace({ ...data, preferences, unread });
  };

  const toggle = async (key: PreferenceKey, value: boolean) => {
    if (!data) return;
    setSavingKey(key);
    withPreferences({ ...data.preferences, [key]: value });
    const result = await accountApi.updatePreferences({ [key]: value });
    setSavingKey(null);
    if (!result.ok) {
      withPreferences(data.preferences);
      toast({ kind: "error", title: "Couldn't save preference", message: result.error });
      return;
    }
    withPreferences(result.data.preferences);
  };

  const markAllRead = async () => {
    setMarking(true);
    const result = await accountApi.markNotificationsRead();
    setMarking(false);
    if (!result.ok) return toast({ kind: "error", title: "Couldn't update", message: result.error });
    withPreferences(result.data.preferences, 0);
  };

  return (
    <Container className="py-6 lg:py-8">
      <AccountPageHeader
        title="Notifications"
        description="Status updates on every order you have placed."
        action={
          data && data.unread > 0 ? (
            <Button variant="secondary" disabled={marking} aria-busy={marking} onClick={markAllRead}>
              <CheckCheck className="size-4" aria-hidden /> Mark all as read
            </Button>
          ) : undefined
        }
      />

      {resource.status === "loading" ? (
        <LoadingState label="Loading notifications…" />
      ) : resource.status === "error" ? (
        <AccountError message={resource.error} code={resource.code} onRetry={reload} />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <section aria-labelledby="activity">
            <h2 id="activity" className="mb-3 flex items-center gap-2 font-display text-lg text-foreground">
              Activity
              {resource.data.unread > 0 && <Badge variant="accent">{resource.data.unread} new</Badge>}
            </h2>
            {resource.data.events.length === 0 ? (
              <EmptyState
                icon={<Bell className="size-7" aria-hidden />}
                title="No notifications yet"
                description="When you place an order, its status updates will show up here."
                action={
                  <Link href="/browse">
                    <Button>Browse stations</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {resource.data.events.map((n) => {
                  const meta = STATUS_META[n.status];
                  const Icon = meta.icon;
                  const unread = Date.parse(n.at) > readAt;
                  return (
                    <li key={n.id}>
                      <Link
                        href={`/account/orders/${n.orderId}`}
                        className={cn(
                          "flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-card transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          unread ? "border-[var(--brand)]/40" : "border-border"
                        )}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cta-soft text-[var(--brand)]">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {unread && <span className="sr-only">New: </span>}
                            {meta.label}
                            <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{n.orderNumber}</span>
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {n.businessName} · {formatKES(n.total)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            <time dateTime={n.at}>{formatRelativeTime(n.at)}</time>
                          </p>
                        </div>
                        {unread && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-[var(--brand)]" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="preferences" className="h-fit rounded-2xl border border-border bg-white p-5 shadow-card">
            <h2 id="preferences" className="font-display text-lg text-foreground">
              Preferences
            </h2>
            <div className="mt-2 divide-y divide-border">
              {PREFERENCES.map((p) => (
                <PreferenceToggle
                  key={p.key}
                  title={p.title}
                  description={p.description}
                  checked={resource.data.preferences[p.key]}
                  busy={savingKey === p.key}
                  onChange={(next) => toggle(p.key, next)}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              M-Pesa payment prompts at checkout aren&apos;t affected by these settings.
            </p>
          </section>
        </div>
      )}
    </Container>
  );
}
