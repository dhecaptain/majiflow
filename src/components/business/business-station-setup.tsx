"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { plans } from "@/lib/data/plans";

interface StationSubscription {
  plan: string;
  status: "trialing" | "active" | "expired" | "cancelled";
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}

interface StationOverview {
  business: {
    id: string;
    slug: string;
    name: string;
    isComplete: boolean;
    isPublished: boolean;
  };
  application: {
    id: string;
    status: string;
    businessName: string;
    address: string;
    city: string;
    zones: string | null;
    deliveryFee: string;
    deliveryTimeMinutes: number;
    plan: string;
    description: string | null;
    latitude: string | null;
    longitude: string | null;
  };
  subscription: StationSubscription | null;
  missingFields: string[];
  eligibility: {
    applicationApproved: boolean;
    listingComplete: boolean;
    subscriptionEligible: boolean;
  };
  eligible: boolean;
  ineligibilityReason: string | null;
}

interface ActionMessage {
  kind: "success" | "error";
  text: string;
}

const FIELD_LABELS: Record<string, string> = {
  businessName: "Business name",
  slug: "Public link",
  address: "Address",
  city: "City",
  zones: "Delivery areas",
  deliveryFee: "Delivery fee",
  deliveryTimeMinutes: "Typical delivery time",
  phone: "Phone",
  email: "Email",
  description: "Description",
  latitude: "Latitude",
  longitude: "Longitude",
};

const subscriptionLabels: Record<StationSubscription["status"], string> = {
  trialing: "Free trial",
  active: "Active paid",
  expired: "Expired",
  cancelled: "Cancelled",
};

const subscriptionVariants: Record<StationSubscription["status"], BadgeProps["variant"]> = {
  trialing: "softAccent",
  active: "success",
  expired: "warning",
  cancelled: "danger",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}

function missingFieldsLabel(fields: string[]) {
  return fields.map((field) => FIELD_LABELS[field] ?? field).join(", ");
}

export function BusinessStationSetup() {
  const [stations, setStations] = React.useState<StationOverview[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Record<string, ActionMessage | null>>({});

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/business/station", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not load your stations.");
      setStations(body.stations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your stations.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  const runAction = async (
    stationId: string,
    action: string,
    path: string,
    body: Record<string, unknown>,
    successMessage: string
  ) => {
    setBusyKey(`${stationId}:${action}`);
    setMessages((prev) => ({ ...prev, [stationId]: null }));
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ businessId: stationId, ...body }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "The action could not be completed.");
      setMessages((prev) => ({ ...prev, [stationId]: { kind: "success", text: successMessage } }));
    } catch (err) {
      setMessages((prev) => ({
        ...prev,
        [stationId]: {
          kind: "error",
          text: err instanceof Error ? err.message : "The action could not be completed.",
        },
      }));
    } finally {
      setBusyKey(null);
      await load(true);
    }
  };

  if (loading) return <LoadingState label="Loading your stations…" />;

  if (error) {
    return (
      <ErrorState
        title="Could not load your stations"
        message={error}
        action={
          error.includes("required") ? (
            <Link href="/login"><Button>Sign in</Button></Link>
          ) : (
            <Button onClick={() => void load()}><RefreshCw className="size-4" aria-hidden /> Try again</Button>
          )
        }
      />
    );
  }

  if (!stations || stations.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="size-6" aria-hidden />}
        title="Station setup unlocks after approval"
        description="Once an application is approved, you can start your free trial, complete the listing and publish it to the public directory."
      />
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-2xl text-foreground">Station setup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Start your free trial, complete your listing, then publish it to the public directory.
          Each step is checked on the server before it can change your station.
        </p>
      </div>

      {stations.map((station) => {
        const busy = busyKey?.startsWith(`${station.business.id}:`) ?? false;
        const message = messages[station.business.id];
        const trialEnd = formatDate(station.subscription?.trialEndsAt ?? null);
        const periodEnd = formatDate(station.subscription?.currentPeriodEnd ?? null);

        return (
          <article
            key={station.business.id}
            className="rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl text-foreground">{station.business.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {station.application.address}, {station.application.city}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={station.business.isComplete ? "success" : "warning"}>
                  {station.business.isComplete ? "Listing complete" : "Listing incomplete"}
                </Badge>
                <Badge variant={station.subscription ? subscriptionVariants[station.subscription.status] : "muted"}>
                  {station.subscription ? subscriptionLabels[station.subscription.status] : "Trial not started"}
                </Badge>
                <Badge variant={station.business.isPublished ? "success" : "muted"}>
                  {station.business.isPublished ? "Published" : "Not published"}
                </Badge>
              </div>
            </div>

            {message && (
              <p
                role={message.kind === "error" ? "alert" : "status"}
                className={`mt-4 rounded-xl p-3 text-sm ${
                  message.kind === "error"
                    ? "bg-danger/10 text-danger"
                    : "bg-brand/5 text-foreground"
                }`}
              >
                {message.text}
              </p>
            )}

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <TrialCard
                station={station}
                busy={busy}
                trialEnd={trialEnd}
                periodEnd={periodEnd}
                onStart={(plan) =>
                  runAction(
                    station.business.id,
                    "trial",
                    "/api/business/station/trial",
                    { plan },
                    "Free trial started. It runs for 14 days."
                  )
                }
              />

              <ListingCard
                station={station}
                busy={busy}
                onSubmit={(fields) =>
                  runAction(
                    station.business.id,
                    "listing",
                    "/api/business/station/listing",
                    fields,
                    "Listing saved. Any remaining required fields are shown above."
                  )
                }
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
              <Button
                className="gap-2"
                disabled={busy || station.business.isPublished || !station.eligible}
                onClick={() =>
                  void runAction(
                    station.business.id,
                    "publish",
                    "/api/business/station/publication",
                    {},
                    "Station published to the public directory."
                  )
                }
                loading={busy}
              >
                {busy ? null : <Rocket className="size-4" aria-hidden />}
                {station.business.isPublished ? "Published" : "Publish station"}
              </Button>
              {station.business.isPublished && (
                <Link
                  href={`/browse/${station.business.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
                >
                  View public page <ExternalLink className="size-3.5" aria-hidden />
                </Link>
              )}
              {!station.business.isPublished && !station.eligible && station.ineligibilityReason && (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                  <span>{station.ineligibilityReason}</span>
                </p>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function TrialCard({
  station,
  busy,
  trialEnd,
  periodEnd,
  onStart,
}: {
  station: StationOverview;
  busy: boolean;
  trialEnd: string | null;
  periodEnd: string | null;
  onStart: (plan: string) => Promise<void>;
}) {
  const defaultPlan = plans.some((plan) => plan.id === station.application.plan)
    ? station.application.plan
    : "growth";
  const [plan, setPlan] = React.useState(defaultPlan);

  return (
    <div className="rounded-2xl border border-border p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles className="size-4 text-[var(--brand)]" aria-hidden /> Free trial
      </h4>
      {!station.subscription && (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Start your 14-day free trial when you are ready. Triple-check your listing first - the
            trial is your only free period and it starts only when you click.
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Field label="Plan" className="min-w-40 flex-1">
              <Select value={plan} onChange={(e) => setPlan(e.target.value)} disabled={busy}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button className="gap-2" disabled={busy} loading={busy} onClick={() => void onStart(plan)}>
              {busy ? null : <CheckCircle2 className="size-4" aria-hidden />}
              Start 14-day free trial
            </Button>
          </div>
        </>
      )}
      {station.subscription?.status === "trialing" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Your free trial is running{trialEnd ? ` and ends on ${trialEnd}` : ""}. Publish before it
          ends to stay in the directory.
        </p>
      )}
      {station.subscription?.status === "active" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Your paid subscription is active{periodEnd ? ` until ${periodEnd}` : ""}.
        </p>
      )}
      {station.subscription?.status === "expired" && (
        <p className="mt-2 text-sm text-muted-foreground">
          Your free trial has ended. A paid subscription is required to publish; contact MajiFlow
          billing to continue.
        </p>
      )}
      {station.subscription?.status === "cancelled" && (
        <p className="mt-2 text-sm text-muted-foreground">
          This subscription was cancelled, so the station no longer qualifies for publication.
        </p>
      )}
    </div>
  );
}

function ListingCard({
  station,
  busy,
  onSubmit,
}: {
  station: StationOverview;
  busy: boolean;
  onSubmit: (fields: Record<string, string | number | null>) => Promise<void>;
}) {
  const application = station.application;
  const [businessName, setBusinessName] = React.useState(application.businessName);
  const [description, setDescription] = React.useState(application.description ?? "");
  const [zones, setZones] = React.useState(application.zones ?? "");
  const [deliveryFee, setDeliveryFee] = React.useState(application.deliveryFee);
  const [deliveryTimeMinutes, setDeliveryTimeMinutes] = React.useState(String(application.deliveryTimeMinutes));
  const [latitude, setLatitude] = React.useState(application.latitude ?? "");
  const [longitude, setLongitude] = React.useState(application.longitude ?? "");

  return (
    <div className="rounded-2xl border border-border p-4">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CheckCircle2 className="size-4 text-[var(--brand)]" aria-hidden /> Listing details
      </h4>
      {station.business.isComplete ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Your listing is complete. Every required field was validated on the server before it was
          marked complete.
        </p>
      ) : (
        <>
          {station.missingFields.length > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Still needed: </span>
              {missingFieldsLabel(station.missingFields)}.
            </p>
          )}
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit({
                businessName,
                description,
                zones,
                deliveryFee,
                deliveryTimeMinutes,
                latitude: latitude.trim() === "" ? null : latitude,
                longitude: longitude.trim() === "" ? null : longitude,
              });
            }}
          >
            <Field label="Business name">
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} disabled={busy} />
            </Field>
            <Field
              label="About your station"
              hint="At least 10 characters. Shown on your public page."
            >
              <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} />
            </Field>
            <Field label="Delivery areas" hint="Comma-separated estates, e.g. Kasarani, Roysambu.">
              <Input value={zones} onChange={(e) => setZones(e.target.value)} disabled={busy} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Delivery fee (KES)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                  disabled={busy}
                />
              </Field>
              <Field label="Delivery time (minutes)">
                <Input
                  type="number"
                  min="1"
                  max="1440"
                  value={deliveryTimeMinutes}
                  onChange={(e) => setDeliveryTimeMinutes(e.target.value)}
                  disabled={busy}
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" hint="Between -90 and 90.">
                <Input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  disabled={busy}
                />
              </Field>
              <Field label="Longitude" hint="Between -180 and 180.">
                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  disabled={busy}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Address, city, phone and email came from your approved application and cannot be
              changed here. Contact support if any of them are wrong.
            </p>
            <Button type="submit" className="gap-2" disabled={busy} loading={busy}>
              {busy ? null : <CheckCircle2 className="size-4" aria-hidden />}
              Save listing
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
