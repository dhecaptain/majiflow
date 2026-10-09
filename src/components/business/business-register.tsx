"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  Loader2,
  MapPin,
  MapPinCheck,
  Navigation,
  PartyPopper,
  Store,
  TriangleAlert,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { plans } from "@/lib/data/plans";
import { formatKES } from "@/lib/format";
import { CITIES, CITY_COORDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STEPS = ["Business details", "Location & delivery", "Choose plan", "Payment"];
const STORAGE_KEY = "mf:business-registration";

/** Water refills are always part of the offering; these are the extras. */
const EXTRA_SERVICES = [
  "Bottled water delivery",
  "Dispenser sales & rental",
  "Office & event supply",
  "Water treatment & testing",
  "Bulk supply to shops",
  "Delivery only",
] as const;

interface CapturedLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  at: string;
  /** True when the coordinates are an approximate town fallback, not a GPS fix. */
  approx?: boolean;
}

interface RegistrationDraft {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  sellsOther: string[];
  otherService: string;
  description: string;
  registrationNumber: string;
  address: string;
  city: string;
  deliveryFee: string;
  zones: string;
  deliveryTime: string;
  plan: string;
  billingPhone: string;
  autoCharge: boolean;
  location: CapturedLocation | null;
}

type Errors = Partial<Record<keyof RegistrationDraft, string>>;

const EMPTY_DRAFT: RegistrationDraft = {
  businessName: "",
  ownerName: "",
  phone: "",
  email: "",
  sellsOther: [],
  otherService: "",
  description: "",
  registrationNumber: "",
  address: "",
  city: "Nairobi",
  deliveryFee: "50",
  zones: "",
  deliveryTime: "45",
  plan: "growth",
  billingPhone: "",
  autoCharge: true,
  location: null,
};

function loadDraft(): RegistrationDraft {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<RegistrationDraft>) };
  } catch {
    /* noop */
  }
  return EMPTY_DRAFT;
}

function saveDraft(draft: RegistrationDraft) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, savedAt: new Date().toISOString(), ...draft })
    );
  } catch {
    /* noop */
  }
}

/**
 * Draft store exposed through useSyncExternalStore so the persisted draft
 * (including any captured location) rehydrates after hydration without a
 * setState-in-effect, while SSR renders the empty draft consistently.
 */
const draftListeners = new Set<() => void>();
let draftCache: RegistrationDraft | null = null;

function subscribeDraft(listener: () => void) {
  draftListeners.add(listener);
  return () => {
    draftListeners.delete(listener);
  };
}

function getDraftSnapshot(): RegistrationDraft {
  if (draftCache === null) draftCache = loadDraft();
  return draftCache;
}

const getDraftServerSnapshot = () => EMPTY_DRAFT;

function writeDraft(next: RegistrationDraft) {
  draftCache = next;
  draftListeners.forEach((listener) => listener());
}

function validateStep(step: number, draft: RegistrationDraft): Errors {
  const errors: Errors = {};

  if (step === 0) {
    if (!draft.businessName.trim()) errors.businessName = "Required";
    if (!draft.ownerName.trim()) errors.ownerName = "Required";
    if (!draft.phone.trim()) errors.phone = "Required";
    const email = draft.email.trim();
    if (!email) errors.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email";
    if (draft.sellsOther.includes("Other") && !draft.otherService.trim())
      errors.otherService = "Tell us what else you sell";
  }

  if (step === 1) {
    if (!draft.address.trim()) errors.address = "Required";
    if (!draft.city.trim()) errors.city = "Required";
    const fee = Number(draft.deliveryFee);
    if (draft.deliveryFee.trim() === "" || Number.isNaN(fee) || fee < 0)
      errors.deliveryFee = "Enter a valid amount";
  }

  if (step === 2) {
    if (!draft.plan) errors.plan = "Pick a plan";
  }

  return errors;
}

/** Why the browser can't give us GPS, or null when it can. */
function geolocationUnavailableReason(): string | null {
  if (typeof window === "undefined") return null;
  if (!window.isSecureContext)
    return "Your browser only shares location over a secure (https) connection. We'll use your town's location instead.";
  if (typeof navigator === "undefined" || !("geolocation" in navigator))
    return "This browser can't share location. We'll use your town's location instead.";
  return null;
}

/** Approximate business coordinates derived from the selected town/city. */
function townLocation(city: string): CapturedLocation {
  const coords = CITY_COORDS[city] ?? CITY_COORDS.Nairobi;
  return { lat: coords.lat, lng: coords.lng, at: new Date().toISOString(), approx: true };
}

export function BusinessRegister() {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const draft = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getDraftServerSnapshot);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const autoAsked = useRef(false);

  const update = useCallback(
    <K extends keyof RegistrationDraft>(key: K, value: RegistrationDraft[K]) => {
      writeDraft({ ...getDraftSnapshot(), [key]: value });
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    },
    []
  );

  const selected = plans.find((p) => p.id === draft.plan) ?? plans[1];

  const captureLocation = useCallback(() => {
    const reason = geolocationUnavailableReason();
    if (reason) {
      setLocationError(reason);
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location: CapturedLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          at: new Date().toISOString(),
        };
        const next = { ...getDraftSnapshot(), location };
        saveDraft(next);
        writeDraft(next);
        setLocating(false);
        toast({ kind: "success", title: "Location saved", message: "We'll use this as your business location." });
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Enable it for this site in your browser settings and try again — or use your town's location below."
            : "We couldn't get your location. Move somewhere with a clearer signal and try again — or use your town's location below."
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [toast]);

  // Fallback so registration is never blocked: save the selected town's
  // approximate coordinates when GPS is unavailable.
  const useTownLocation = useCallback(() => {
    const location = townLocation(getDraftSnapshot().city);
    const next = { ...getDraftSnapshot(), location };
    saveDraft(next);
    writeDraft(next);
    setLocationError(null);
    toast({
      kind: "success",
      title: "Approximate location saved",
      message: "We'll use your town's location and you can refine it later.",
    });
  }, [toast]);

  // Ask automatically the first time the owner reaches the location step.
  useEffect(() => {
    if (step === 1 && !draft.location && !autoAsked.current) {
      autoAsked.current = true;
      captureLocation();
    }
  }, [step, draft.location, captureLocation]);

  const goNext = () => {
    const stepErrors = validateStep(step, draft);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length > 0) {
      toast({ kind: "error", title: "Almost there", message: "Fill in the required fields to continue." });
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = () => {
    for (let i = 0; i <= 2; i++) {
      const stepErrors = validateStep(i, draft);
      if (Object.keys(stepErrors).length > 0) {
        setErrors(stepErrors);
        setStep(i);
        toast({ kind: "error", title: "Almost there", message: "Fill in the required fields to continue." });
        return;
      }
    }
    // Location is a must, but never a dead end: fall back to the town's
    // approximate coordinates when GPS wasn't captured.
    const finalDraft = draft.location ? draft : { ...draft, location: townLocation(draft.city) };
    saveDraft(finalDraft);
    writeDraft(finalDraft);
    setDone(true);
  };

  if (done) {
    return (
      <Container className="py-16 lg:py-24">
        <div className="mx-auto max-w-xl rounded-3xl border border-border bg-white p-8 text-center shadow-layered sm:p-12">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-accent">
            <PartyPopper className="size-7" aria-hidden />
          </span>
          <h1 className="mt-6 font-display text-3xl text-foreground">
            Karibu, {draft.businessName.trim() || "friend"}!
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Your business profile is set up on the{" "}
            <strong className="text-foreground">{selected.name}</strong> plan. MajiFlow is free while we
            finish building — your details, including your business location, are saved for when the
            platform goes live.
          </p>

          <dl className="mt-6 space-y-2 rounded-2xl bg-muted/50 p-5 text-left text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Plan</dt>
              <dd className="font-semibold text-foreground">
                {selected.name} · free for now
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Registered to</dt>
              <dd className="font-semibold text-foreground">{draft.ownerName || "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="font-semibold text-foreground">{draft.phone || "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Business location</dt>
              <dd className="text-right font-mono text-xs text-foreground">
                {draft.location
                  ? `${draft.location.lat.toFixed(5)}, ${draft.location.lng.toFixed(5)}`
                  : "—"}
                {draft.location?.approx && (
                  <span className="block font-sans text-[11px] text-muted-foreground">
                    Approximate ({draft.city})
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/business">
              <Button size="lg" className="group w-full sm:w-auto">
                Open my dashboard
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </Link>
            <Link href="/business/demo">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Take the tour first
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-14 lg:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <Store className="size-3.5 text-[#0052FF]" aria-hidden /> Business onboarding
          </p>
          <h1 className="mt-3 font-display text-3xl text-foreground sm:text-4xl">
            Get your station online in <span className="text-gradient">one lunch break</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Four short steps, no card required. MajiFlow is free for now — your details and business
            location are saved for when we launch billing.
          </p>
        </div>

        {/* Stepper */}
        <ol className="mt-10 flex items-center justify-between gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col items-center gap-2 text-center">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full font-mono text-xs font-semibold",
                  i < step
                    ? "bg-brand-gradient text-white"
                    : i === step
                      ? "bg-[#0052FF]/10 text-[#0052FF] ring-2 ring-[#0052FF]/25"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {i < step ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span className={cn("text-[11px] font-medium sm:text-xs", i <= step ? "text-foreground" : "text-muted-foreground")}>
                {label}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-3xl border border-border bg-white p-6 shadow-card sm:p-8">
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="flex items-center gap-2 font-display text-xl text-foreground">
                <Building2 className="size-5 text-[#0052FF]" aria-hidden /> Tell us about the business
              </h2>
              <Field label="Business name" required error={errors.businessName}>
                <Input
                  placeholder="e.g. BioWater Refill Station"
                  value={draft.businessName}
                  onChange={(e) => update("businessName", e.target.value)}
                  invalid={Boolean(errors.businessName)}
                  autoComplete="organization"
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Owner name" required error={errors.ownerName}>
                  <Input
                    placeholder="Grace Mwangi"
                    value={draft.ownerName}
                    onChange={(e) => update("ownerName", e.target.value)}
                    invalid={Boolean(errors.ownerName)}
                    autoComplete="name"
                  />
                </Field>
                <Field label="Phone (M-Pesa)" required error={errors.phone}>
                  <Input
                    type="tel"
                    placeholder="+254 712 345 678"
                    value={draft.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    invalid={Boolean(errors.phone)}
                    autoComplete="tel"
                  />
                </Field>
              </div>
              <Field label="Email" required error={errors.email} hint="For receipts and account recovery.">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={draft.email}
                  onChange={(e) => update("email", e.target.value)}
                  invalid={Boolean(errors.email)}
                  autoComplete="email"
                />
              </Field>

              {/* What do you sell */}
              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-foreground">
                  What do you sell?<span className="text-[#0052FF]"> *</span>
                </p>
                <div role="group" aria-label="What do you sell?" className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0052FF]/30 bg-[#0052FF]/5 px-3 py-1.5 text-sm font-medium text-[#0052FF]">
                    <Check className="size-3.5" aria-hidden /> Water refills
                  </span>
                  {EXTRA_SERVICES.map((service) => {
                    const on = draft.sellsOther.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          update(
                            "sellsOther",
                            on ? draft.sellsOther.filter((s) => s !== service) : [...draft.sellsOther, service]
                          )
                        }
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                          on
                            ? "border-[#0052FF] bg-[#0052FF]/10 text-[#0052FF]"
                            : "border-border bg-white text-muted-foreground hover:border-[#0052FF]/40 hover:text-[#0052FF]"
                        )}
                      >
                        {service}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    aria-pressed={draft.sellsOther.includes("Other")}
                    onClick={() =>
                      update(
                        "sellsOther",
                        draft.sellsOther.includes("Other")
                          ? draft.sellsOther.filter((s) => s !== "Other")
                          : [...draft.sellsOther, "Other"]
                      )
                    }
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                      draft.sellsOther.includes("Other")
                        ? "border-[#0052FF] bg-[#0052FF]/10 text-[#0052FF]"
                        : "border-border bg-white text-muted-foreground hover:border-[#0052FF]/40 hover:text-[#0052FF]"
                    )}
                  >
                    Other
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Water refills are always part of your catalogue — add anything else you offer.
                </p>
                {draft.sellsOther.includes("Other") && (
                  <Field label="Other services" error={errors.otherService} className="pt-1">
                    <Input
                      placeholder="e.g. Commercial water softeners"
                      value={draft.otherService}
                      onChange={(e) => update("otherService", e.target.value)}
                      invalid={Boolean(errors.otherService)}
                    />
                  </Field>
                )}
              </div>

              <Field
                label="Business registration number"
                hint="KRA PIN or certificate number — optional, you can add it later."
              >
                <Input
                  placeholder="e.g. P051234567X"
                  value={draft.registrationNumber}
                  onChange={(e) => update("registrationNumber", e.target.value)}
                />
              </Field>

              <Field label="Short description" hint="Optional — a sentence or two customers will see.">
                <Textarea
                  rows={3}
                  placeholder="Family-run since 2018. UV-treated borehole water, delivered on boda within the hour."
                  value={draft.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <h2 className="flex items-center gap-2 font-display text-xl text-foreground">
                <MapPin className="size-5 text-[#0052FF]" aria-hidden /> Where do you deliver?
              </h2>
              <Field label="Station address" required error={errors.address}>
                <Input
                  placeholder="Mwiki Road, Kasarani, Nairobi"
                  value={draft.address}
                  onChange={(e) => update("address", e.target.value)}
                  invalid={Boolean(errors.address)}
                />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Town / city" required error={errors.city}>
                  <Select value={draft.city} onChange={(e) => update("city", e.target.value)} invalid={Boolean(errors.city)}>
                    {CITIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Default delivery fee (KES)" error={errors.deliveryFee}>
                  <Input
                    type="number"
                    min={0}
                    value={draft.deliveryFee}
                    onChange={(e) => update("deliveryFee", e.target.value)}
                    invalid={Boolean(errors.deliveryFee)}
                  />
                </Field>
              </div>

              {/* Business location capture */}
              <div className="space-y-2">
                <p className="text-[13px] font-semibold text-foreground">
                  Business location<span className="text-[#0052FF]"> *</span>
                </p>
                <div
                  className={cn(
                    "rounded-2xl border p-4",
                    draft.location ? "border-success/40 bg-success/5" : "border-border bg-white"
                  )}
                >
                  {draft.location ? (
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                        <MapPinCheck className="size-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {draft.location.approx ? "Approximate location saved" : "Location captured & saved"}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {draft.location.lat.toFixed(5)}, {draft.location.lng.toFixed(5)}
                          {draft.location.accuracy != null && ` · ±${Math.round(draft.location.accuracy)}m`}
                        </p>
                        {draft.location.approx && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Based on {draft.city} — you can refine this later.
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={captureLocation}
                          disabled={locating}
                          className="mt-2 text-xs font-semibold text-[#0052FF] hover:underline disabled:opacity-50"
                        >
                          {locating ? "Updating…" : "Use my exact location instead"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0052FF]/10 text-[#0052FF]">
                          <MapPin className="size-5" aria-hidden />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Allow location access</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            We use this to place your station on the map and match you with nearby customers.
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        <Button variant="secondary" onClick={captureLocation} disabled={locating}>
                          {locating ? (
                            <>
                              <Loader2 className="size-4 animate-spin" aria-hidden /> Getting location…
                            </>
                          ) : (
                            <>
                              <Navigation className="size-4" aria-hidden /> Allow location
                            </>
                          )}
                        </Button>
                        <button
                          type="button"
                          onClick={useTownLocation}
                          className="text-xs font-semibold text-[#0052FF] hover:underline"
                        >
                          Can&apos;t allow? Use {draft.city} instead
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {locationError ? (
                  <p className="flex items-start gap-1.5 text-xs text-danger">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {locationError}
                  </p>
                ) : (
                  !draft.location && (
                    <p className="text-xs text-muted-foreground">
                      Required — your business location is saved to your profile. If your browser can&apos;t
                      share it, use your town&apos;s location.
                    </p>
                  )
                )}
              </div>

              <Field label="Delivery zones" hint="Comma-separated for now — the dashboard lets you fine-tune fees per zone.">
                <Input
                  placeholder="Kasarani, Roysambu, Kahawa West, Githurai"
                  value={draft.zones}
                  onChange={(e) => update("zones", e.target.value)}
                />
              </Field>
              <Field label="Typical delivery time">
                <Select value={draft.deliveryTime} onChange={(e) => update("deliveryTime", e.target.value)}>
                  <option value="30">Under 30 minutes</option>
                  <option value="45">30–60 minutes</option>
                  <option value="90">1–2 hours</option>
                  <option value="240">Same day</option>
                </Select>
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-xl text-foreground">Pick your plan</h2>
                <Badge variant="success">Free for now</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Choose the plan that fits today. Nothing is charged while MajiFlow is in early access — you
                can change this later.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {plans.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => update("plan", p.id)}
                    className={cn(
                      "rounded-2xl border p-4 text-left transition-all",
                      draft.plan === p.id ? "border-[#0052FF] ring-2 ring-[#0052FF]/15" : "border-border hover:border-[#0052FF]/40"
                    )}
                    aria-pressed={draft.plan === p.id}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-lg text-foreground">{p.name}</span>
                      {p.highlighted && <Badge variant="accent">Popular</Badge>}
                    </div>
                    <p className="mt-2 font-display text-2xl text-foreground">
                      {formatKES(p.monthlyPrice)}
                      <span className="text-xs font-normal text-muted-foreground">/mo</span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{p.audience}</p>
                  </button>
                ))}
              </div>
              <ul className="space-y-2 rounded-2xl bg-muted/50 p-5 text-sm text-muted-foreground">
                {selected.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-[#0052FF]" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="flex items-center gap-2 font-display text-xl text-foreground">
                <CreditCard className="size-5 text-[#0052FF]" aria-hidden /> How should we bill you?
              </h2>
              <div className="rounded-2xl border border-[#0052FF]/25 bg-[#0052FF]/5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-display text-lg text-foreground">{selected.name} plan</p>
                    <p className="text-sm text-muted-foreground">
                      {formatKES(selected.monthlyPrice)}/month once billing starts
                    </p>
                  </div>
                  <Badge variant="success">Free for now</Badge>
                </div>
              </div>
              <p className="rounded-xl bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
                You won&apos;t be charged today. Add your M-Pesa number below and we&apos;ll use it when billing goes
                live — you can skip this and add it later in Settings.
              </p>
              <Field label="M-Pesa number for billing" hint="Optional for now.">
                <Input
                  type="tel"
                  placeholder="+254 712 345 678"
                  value={draft.billingPhone}
                  onChange={(e) => update("billingPhone", e.target.value)}
                  autoComplete="tel"
                />
              </Field>
              <label className="flex items-start gap-3 rounded-xl border border-border p-4">
                <input
                  type="checkbox"
                  checked={draft.autoCharge}
                  onChange={(e) => update("autoCharge", e.target.checked)}
                  className="mt-0.5 size-4 accent-[#0052FF]"
                />
                <span className="text-sm leading-relaxed text-muted-foreground">
                  Charge my M-Pesa on the 1st of each month once billing starts. I can cancel anytime — my
                  public page stays up until the end of the paid period.
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                No card, no hidden fees. We&apos;ll remind you before any charge.
              </p>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
            <Button variant="ghost" className="gap-2" onClick={goBack} disabled={step === 0}>
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                className="group"
                onClick={goNext}
                disabled={step === 1 && !draft.location && !locationError}
              >
                Continue
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button size="lg" className="group" onClick={submit}>
                Start free — no card
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[#0052FF] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </Container>
  );
}
