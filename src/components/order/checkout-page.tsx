"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Transition } from "framer-motion";
import {
  AlertCircle, ArrowLeft, CheckCircle2, CreditCard, MapPin, Navigation, RefreshCcw, ShieldCheck, Smartphone, Store, User } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button, buttonVariants } from "@/components/ui/button";
import { LoadingState } from "@/components/ui/feedback";
import { OrderMap } from "@/components/ui/order-map";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useCart } from "@/components/order/cart-provider";
import { useOrderSession } from "@/components/order/order-session-provider";
import { useCustomer, type CustomerProfile } from "@/components/order/customer-provider";
import { useToast } from "@/components/ui/toast";
import { businesses } from "@/lib/data/businesses";
import { CITIES, ESTATES } from "@/lib/constants";
import { formatKES } from "@/lib/format";
import { computeCartTotals } from "@/lib/pricing";
import {
  captureLocationBestEffort,
  geolocationErrorMessage,
  nearestPlace,
  resolveCity,
  reverseGeocode,
  type CapturedLocation,
} from "@/lib/geo";
import { createOrder, fetchOrder, generateOrderNumber, OrderValidationError, postLocation } from "@/lib/orders";
import { resolveCart } from "@/lib/cart";
import { useMotionSafe } from "@/lib/motion";
import type { DeliveryAddress, Order, PaymentMethod } from "@/lib/types";
import { ButtonLoader } from "@/components/ui/button-loader";
import { MpesaWait } from "@/components/motion/mpesa-wait";
import { SuccessCheck } from "@/components/motion/success-check";
import { OrderTotalsList } from "@/components/shared/order-totals";
import { SendWaterSummary } from "@/components/order/send-water-summary";

type PayState = "idle" | "working" | "awaiting-provider" | "failed" | "stale";
type FieldErrors = Record<string, string>;

const CONSENT_KEY = "mf:profileConsent";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SERVER_FIELD_MAP: Record<string, string> = {
  customerName: "name",
  customerPhone: "phone",
  phone: "phone",
  city: "city",
  estate: "estate",
  notes: "notes",
  items: "_form",
  address: "_form",
  subtotal: "_form",
  total: "_form",
  payment: "_form",
};

function mapServerFields(fields: Record<string, string>): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, message] of Object.entries(fields)) {
    out[SERVER_FIELD_MAP[key] ?? "_form"] = message;
  }
  return out;
}

function makeId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function readConsent(): boolean {
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

function writeConsent(v: boolean) {
  try {
    window.localStorage.setItem(CONSENT_KEY, v ? "1" : "0");
  } catch {
    /* noop */
  }
}

function defaultAddress(profile: CustomerProfile): DeliveryAddress | undefined {
  return profile.addresses[profile.defaultAddressIndex] ?? profile.addresses[0];
}

function addressLocation(a: DeliveryAddress | undefined): CapturedLocation | null {
  if (!a || typeof a.lat !== "number" || typeof a.lng !== "number") return null;
  return { lat: a.lat, lng: a.lng, accuracy: a.accuracy, at: a.locationAt ?? "" };
}

/** Delivery fields prefilled from the location saved in the user's profile. */
function prefillFromAddress(a: DeliveryAddress | undefined) {
  const location = addressLocation(a);
  const near = location ? nearestPlace(location.lat, location.lng) : {};
  return {
    city: a?.city || near.city || "Nairobi",
    estate: a?.estate || near.estate || "",
    street: a?.street ?? "",
    building: a?.building ?? "",
    floor: a?.floor ?? "",
    notes: a?.landmark ?? "",
    location,
  };
}

export function CheckoutPage() {
  const { hydrated, accountSynced } = useCustomer();
  // Re-prefill once when a signed-in customer's saved details arrive from the server.
  return <CheckoutForm key={!hydrated ? "initial" : accountSynced ? "account" : "hydrated"} />;
}

function CheckoutForm() {
  const router = useRouter();
  const { items, clear, hydrated: cartHydrated } = useCart();
  const { profile, loggedIn, saveProfileDetails } = useCustomer();
  const { fulfilment } = useOrderSession();
  const { toast } = useToast();
  // Collection from the station: no delivery fee, and the order is collected
  // at the station's own address.
  const pickup = fulfilment === "pickup";

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email ?? "");
  const [prefill] = useState(() => prefillFromAddress(defaultAddress(profile)));
  const [city, setCity] = useState(prefill.city);
  const [estate, setEstate] = useState(prefill.estate);
  const [street, setStreet] = useState(prefill.street);
  const [building, setBuilding] = useState(prefill.building);
  const [floor, setFloor] = useState(prefill.floor);
  const [notes, setNotes] = useState(prefill.notes);
  const [location, setLocation] = useState<CapturedLocation | null>(prefill.location);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [saveProfile, setSaveProfile] = useState(readConsent);
  const [shareLocation, setShareLocation] = useState(true);
  const [smsUpdates, setSmsUpdates] = useState(true);
  const [touch, setTouch] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [payState, setPayState] = useState<PayState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const { reduce, transition } = useMotionSafe();

  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const attemptKeyRef = useRef<string | null>(null);
  const lastSigRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const paymentIdRef = useRef<string | null>(null);
  const orderIdsRef = useRef<string[] | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  // The mobile pay bar owns the bottom of the screen; tell the toast stack to
  // sit above it so notifications never cover the pay button.
  useEffect(() => {
    if (payState !== "idle") return;
    document.documentElement.dataset.checkoutPayBar = "true";
    return () => {
      delete document.documentElement.dataset.checkoutPayBar;
    };
  }, [payState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cart = useMemo(() => resolveCart(items, businesses), [items]);
  const rows = cart.orderable;
  const cartProblems = cart.problems;

  const totals = computeCartTotals(
    rows.map((r) => ({
      businessId: r.business!.id,
      quantity: r.line.quantity,
      unitPrice: r.unitPrice,
      deposit: r.deposit,
    })),
    pickup
      ? businesses.map((b) => ({ id: b.id, deliveryFee: 0, freeDeliveryAbove: 0 }))
      : businesses
  );
  const { total } = totals;
  const totalsByStation = new Map(totals.groups.map((group) => [group.businessId, group]));
  const station = rows[0]?.business;

  const savedAddress = defaultAddress(profile);
  const profileComplete = Boolean(profile.name && profile.phone && typeof savedAddress?.lat === "number");

  const signature = useMemo(
    () =>
      [
        rows
          .map((r) => `${r.line.businessId}:${r.line.productId}:${r.line.optionId ?? ""}:${r.line.quantity}`)
          .join(","),
        name.trim(),
        phone.trim(),
        email.trim(),
        city,
        estate.trim(),
        street.trim(),
        building.trim(),
        floor.trim(),
        notes.trim(),
        method,
        fulfilment,
        location ? `${location.lat},${location.lng}` : "",
      ].join("|"),
    [rows, name, phone, email, city, estate, street, building, floor, notes, method, fulfilment, location]
  );

  const ensureAttemptKey = () => {
    if (attemptKeyRef.current === null || lastSigRef.current !== signature) {
      attemptKeyRef.current = makeId();
      lastSigRef.current = signature;
    }
    return attemptKeyRef.current;
  };

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    const n = name.trim();
    if (!n || n.length < 2) {
      errs.name = "Enter your full name.";
    } else if (!/^[\p{L}\p{M}'’.\- ]+$/u.test(n) || n.length > 80) {
      errs.name = "Name can only contain letters (up to 80 chars).";
    }
    const p = phone.trim();
    let digits = p.replace(/[\s()\-.]/g, "");
    if (digits.startsWith("+254")) digits = "0" + digits.slice(4);
    else if (digits.startsWith("254")) digits = "0" + digits.slice(3);
    if (!/^0\d{9}$/.test(digits)) {
      errs.phone = "Use a Kenyan number, e.g. 07XX XXX XXX or +254 7XX….";
    }
    if (!city) errs.city = "Choose your town.";
    // A collected order is collected at the station, so it needs no address.
    if (!pickup && !estate.trim())
      errs.estate = "Tell us your area - riders use it to navigate.";
    if (notes.length > 500) errs.notes = "Directions must be under 500 characters.";
    // A phone-first customer has no email, so an empty field is fine. An
    // account that already has one cannot leave it blank.
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      errs.email = "Enter a valid email address.";
    } else if (!email.trim() && profile.email && saveProfile) {
      errs.email = "Your email is your sign-in and can't be left blank.";
    }
    return errs;
  };

  const focusField = (key: string) => {
    formRef.current
      ?.querySelector<HTMLElement>(`[name="${key}"]`)
      ?.focus();
  };

  const allowNewLocation = async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const loc = await captureLocationBestEffort();
      const near = nearestPlace(loc.lat, loc.lng);
      const geo = await reverseGeocode(loc.lat, loc.lng, loc.accuracy);
      const nextEstate = geo?.estate || near.estate || "";
      const nextCity = resolveCity(geo?.city, near.city) ?? city;
      setLocation(loc);
      if (nextEstate) setEstate(nextEstate);
      setCity(nextCity);
      if (geo?.street) setStreet(geo.street);
      if (geo?.building) setBuilding(geo.building);
      toast({
        kind: "success",
        title: "New location set",
        message: nextEstate
          ? `We'll deliver to ${nextEstate}${nextCity ? `, ${nextCity}` : ""}.`
          : "We'll deliver to your current location.",
      });
    } catch (err) {
      setLocationError(geolocationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  const submitDelivery = (e: React.FormEvent) => {
    e.preventDefault();
    setTouch(true);
    const errs = validate();
    setErrors(errs);
    const first = ["name", "phone", "email", "city", "estate", "street", "notes"].find((k) => errs[k]);
    if (first) {
      toast({
        kind: "error",
        title: "A few details need fixing",
        message:
          errs[first] ??
          "Please correct the highlighted fields before paying. Nothing was charged.",
      });
      focusField(first);
      return;
    }
    startPayment();
  };

  const stationBlockers = cart.stationBlockers;

  const startPayment = () => {
    setErrors({});
    if (cartProblems.length > 0) {
      const message = "Some items in your cart need attention - review your cart before paying.";
      setErrors({ _form: message });
      toast({ kind: "error", title: "Check your cart", message });
      return;
    }
    if (stationBlockers.length > 0) {
      setErrors({ _form: stationBlockers[0].reason });
      toast({ kind: "error", title: "Station unavailable", message: stationBlockers[0].reason });
      return;
    }
    ensureAttemptKey();
    setPayState("working");
    void runCheckout();
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function pollPayment(paymentId: string): Promise<string> {
    // ~2 minutes of provider grace, then the order page takes over.
    for (let i = 0; i < 40; i++) {
      await sleep(3000);
      if (!mountedRef.current) return "pending";
      try {
        const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, { cache: "no-store" });
        if (!res.ok) continue;
        const data = (await res.json()) as { payment?: { status?: string; failureReason?: string | null } };
        const status = data.payment?.status ?? "pending";
        if (status !== "pending") {
          if (data.payment?.failureReason) setStatusMessage(data.payment.failureReason);
          return status;
        }
        setPayState("awaiting-provider");
      } catch {
        /* transient - keep polling */
      }
    }
    return "pending";
  }

  const simulateProviderApproval = async () => {
    if (!paymentIdRef.current) return;
    try {
      await fetch("/api/payments/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true, paymentId: paymentIdRef.current, outcome: "success" }),
      });
    } catch {
      /* the poller surfaces the real state either way */
    }
  };

  /**
   * Re-reads the payment status from the server. Read-only: it never creates a
   * second charge, it just asks the provider state we already have.
   */
  const recheckPayment = async () => {
    const paymentId = paymentIdRef.current;
    if (!paymentId) return;
    try {
      const res = await fetch(`/api/payments/${encodeURIComponent(paymentId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { payment?: { status?: string; failureReason?: string | null } };
      const status = data.payment?.status ?? "pending";
      if (status === "success") {
        const created = orderIdsRef.current ?? [];
        const confirmed: Order[] = [];
        for (const id of created) {
          const fresh = await fetchOrder(id);
          if (fresh) confirmed.push(fresh);
        }
        const first = confirmed[0];
        if (!first) return;
        setLastOrder(first);
        clear();
        setPayState("idle");
        toast({
          kind: "success",
          title: "Payment confirmed",
          message: `Order ${first.orderNumber} is paid and with ${first.businessName}.`,
        });
        window.setTimeout(() => router.push(`/order/${first.id}`), 1200);
      } else if (status !== "pending") {
        setStatusMessage(
          status === "cancelled"
            ? "Payment was cancelled - no money left your account."
            : status === "timeout"
              ? "Confirmation took too long - no money left your account."
              : "Payment failed - no money left your account."
        );
        setPayState("failed");
      }
    } catch {
      /* transient - the poller keeps watching */
    }
  };

  /**
   * Verified checkout: create PENDING orders first (the server validates
   * hours, catalog prices, stock, and totals), then initiate payment, then
   * wait for the provider - never the customer's word - to confirm it.
   */
  const runCheckout = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setStatusMessage(null);
    try {
      let coords: CapturedLocation | null = location;
      let addrEstate = estate;
      let addrStreet = street;
      let addrCity = city;
      let addrBuilding = building;
      if (!coords && shareLocation) {
        try {
          coords = await captureLocationBestEffort();
          const near = nearestPlace(coords.lat, coords.lng);
          const geo = await reverseGeocode(coords.lat, coords.lng, coords.accuracy);
          if (!addrEstate) addrEstate = geo?.estate || near.estate || "";
          if (!addrStreet) addrStreet = geo?.street || "";
          if (!addrCity) addrCity = resolveCity(geo?.city, near.city) ?? city;
          if (!addrBuilding) addrBuilding = geo?.building || "";
        } catch {
          coords = null;
        }
      }
      const groups = new Map<string, typeof rows>();
      for (const r of rows) {
        const list = groups.get(r.business!.id) ?? [];
        list.push(r);
        groups.set(r.business!.id, list);
      }
      const attemptKey = ensureAttemptKey();
      let created: Order[];
      if (orderIdsRef.current) {
        // Retry after a failed payment: the pending orders already exist,
        // so rejoin them instead of duplicating.
        const existing: Order[] = [];
        for (const id of orderIdsRef.current) {
          const found = await fetchOrder(id);
          if (found) existing.push(found);
        }
        if (existing.length !== orderIdsRef.current.length) {
          throw new Error("An order went missing - please start checkout again.");
        }
        created = existing;
      } else {
        created = [];
        for (const group of groups.values()) {
          const station = group[0].business!;
          // The station totals come from the same calculation the summary shows,
          // so the amount charged can never drift from the amount displayed.
          const stationTotals = totalsByStation.get(station.id);
          const groupSubtotal =
            stationTotals?.subtotal ??
            group.reduce((s, r) => s + r.unitPrice * r.line.quantity, 0);
          const groupFee = pickup
            ? 0
            : (stationTotals?.deliveryFee ??
              (groupSubtotal >= station.freeDeliveryAbove ? 0 : station.deliveryFee));
          const groupDeposit =
            stationTotals?.deposit ??
            group.reduce((s, r) => s + r.deposit * r.line.quantity, 0);
          const order: Order = {
            id: `order-${attemptKey}-${station.id}`,
            orderNumber: generateOrderNumber(),
            businessId: station.id,
            businessName: station.name,
            customerName: name,
            customerPhone: phone,
            items: group.map((r) => ({
              productId: r.product!.id,
              name: r.product!.name,
              quantity: r.line.quantity,
              unitPrice: r.unitPrice,
              ...(r.option
                ? { optionId: r.option.id, optionLabel: r.option.label, deposit: r.deposit }
                : {}),
            })),
            subtotal: groupSubtotal,
            deliveryFee: groupFee,
            deposit: groupDeposit,
            total: stationTotals?.total ?? groupSubtotal + groupFee + groupDeposit,
            fulfilment,
            payment: method,
            paymentState: "pending",
            status: "pending",
            address: pickup
              ? {
                  label: "Pickup",
                  estate: station.name,
                  city: station.city,
                  notes: `Collect from ${station.name}`,
                  phone,
                  lat: station.lat,
                  lng: station.lng,
                }
              : {
                  label: "Delivery",
                  estate: addrEstate || addrBuilding || "Area on file",
                  street: addrStreet.trim() || undefined,
                  city: addrCity || undefined,
                  building: addrBuilding || undefined,
                  floor: floor || undefined,
                  landmark: notes.trim() || undefined,
                  notes: notes || undefined,
                  phone,
                  lat: coords?.lat,
                  lng: coords?.lng,
                  accuracy: coords?.accuracy,
                  locationAt: coords?.at,
                },
            placedAt: new Date().toISOString(),
            eta: pickup ? "Ready to collect" : "≈ 50 min",
            consent: { location: shareLocation, smsUpdates, updatedAt: new Date().toISOString() },
          };
          created.push(await createOrder(order));
        }
        orderIdsRef.current = created.map((o) => o.id);
      }

      const payable = created.reduce((s, o) => s + o.total, 0);
      const initRes = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: created.map((o) => o.id),
          phone,
          method,
          // A fresh key per payment attempt: retries never double-charge.
          idempotencyKey: `${attemptKey}-${created.map((o) => o.id).join("+")}-${makeId()}`,
        }),
      });
      if (!initRes.ok) {
        const detail = (await initRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? "Payment could not be started.");
      }
      const init = (await initRes.json()) as {
        payment: { id: string; amount: number; status: string };
        testMode?: boolean;
      };
      paymentIdRef.current = init.payment.id;
      setTestMode(init.testMode === true);
      setPayState("awaiting-provider");

      const outcome = await pollPayment(init.payment.id);
      if (!mountedRef.current) return;
      if (outcome === "success") {
        const confirmed: Order[] = [];
        for (const o of created) {
          const fresh = await fetchOrder(o.id);
          if (fresh) confirmed.push(fresh);
        }
        const first = confirmed[0] ?? created[0];
        if (shareLocation && coords) {
          await Promise.all(
            created.map((o) =>
              postLocation(o.id, {
                lat: coords!.lat,
                lng: coords!.lng,
                accuracy: coords!.accuracy,
                at: coords!.at,
              })
            )
          );
        }
        setLastOrder(first);
        clear();
        if (saveProfile) {
          saveProfileDetails({
            name,
            phone,
            email: email.trim() || undefined,
            address: {
              label: "Home",
              estate: addrEstate,
              street: addrStreet.trim() || undefined,
              city: addrCity || undefined,
              building: addrBuilding.trim() || undefined,
              floor: floor.trim() || undefined,
              landmark: notes.trim() || undefined,
              phone,
              lat: coords?.lat,
              lng: coords?.lng,
              accuracy: coords?.accuracy,
              locationAt: coords?.at,
            },
          });
        }
        setPayState("idle");
        toast({
          kind: "success",
          title: "Payment confirmed",
          message:
            confirmed.length > 1
              ? `${confirmed.length} orders paid (${formatKES(payable)}). Start with ${first.orderNumber} - ${first.businessName}.`
              : `Order ${first.orderNumber} is paid and with ${first.businessName}. Track it now.`,
        });
        window.setTimeout(() => router.push(`/order/${first.id}`), 1600);
      } else if (outcome === "pending") {
        // Poll budget spent but the provider may still confirm late.
        setPayState("stale");
        setStatusMessage(
          "Still waiting on the provider - your orders are saved as pending. Check the order page; it updates the moment payment lands."
        );
      } else {
        setPayState("failed");
        if (!statusMessage) {
          setStatusMessage(
            outcome === "cancelled"
              ? "Payment was cancelled - no money left your account."
              : outcome === "timeout"
                ? "Confirmation took too long - no money left your account."
                : "Payment failed - no money left your account."
          );
        }
      }
    } catch (err) {
      const fields = err instanceof OrderValidationError ? mapServerFields(err.fields) : {};
      setErrors(fields);
      setPayState("failed");
      toast({
        kind: "error",
        title: "Order not placed",
        message:
          err instanceof OrderValidationError
            ? (fields._form ?? "Please fix the highlighted fields and retry.")
            : err instanceof Error
              ? err.message
              : "We hit a snag - nothing was charged and nothing was duplicated, so please retry.",
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (lastOrder) {
    return (
      <Container className="py-24">
        <div className="mx-auto max-w-md text-center">
          <SuccessCheck className="mx-auto" />
          <h1 className="mt-2 font-display text-3xl text-foreground">Order confirmed</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            <strong className="text-foreground">{lastOrder.orderNumber}</strong> ·{" "}
            {lastOrder.businessName} · <strong className="text-foreground">{formatKES(lastOrder.total)}</strong>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Thanks for ordering. We&apos;ll text you as it moves along, and you can follow it live from here.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={`/order/${lastOrder.id}`}>
              <Button size="lg" className="w-full sm:w-auto">Track order</Button>
            </Link>
            <Link href="/browse">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Continue browsing
              </Button>
            </Link>
          </div>
        </div>
      </Container>
    );
  }

  if (!cartHydrated) {
    return (
      <Container className="py-24">
        <LoadingState label="Loading your order…" />
      </Container>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-3xl text-foreground">Nothing to check out</h1>
        <p className="mt-3 text-muted-foreground">Your cart is empty. Add water from a station first.</p>
        <Link href="/browse" className={buttonVariants({ size: "lg", className: "mt-6" })}>
          Browse stations
        </Link>
      </Container>
    );
  }

  if (rows.length === 0 || cartProblems.length > 0) {
    return (
      <Container className="py-24 text-center">
        <h1 className="font-display text-3xl text-foreground">Your cart needs a quick check</h1>
        <p className="mx-auto mt-3 max-w-md text-muted-foreground">
          {cartProblems.length === 1 ? "One item is" : `${cartProblems.length} items are`} unavailable or over the
          stock a station can fill. Update your cart, then come back to pay - nothing has been charged.
        </p>
        <Link href="/cart" className={buttonVariants({ size: "lg", className: "mt-6" })}>
          Review cart
        </Link>
      </Container>
    );
  }

  return (
    <>
      <Container className="py-14 pb-32 lg:py-20">
      <div className="mb-8">
        <Link
          href="/cart"
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to cart
        </Link>
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-foreground animate-pulse-dot" /> Delivery & payment
        </p>
        <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Finish your order</h1>
      </div>

      <form
        id="checkout-form"
        ref={formRef}
        onSubmit={submitDelivery}
        className="grid gap-8 lg:grid-cols-[1.5fr_0.9fr]"
        noValidate
      >
        {/* Delivery details */}
        <div className="flex min-w-0 flex-col gap-8">
          {loggedIn && !profileComplete && (
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--brand)]/20 bg-brand/5 p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" aria-hidden />
              <p className="text-sm text-foreground/85">
                <strong className="font-semibold text-foreground">Finish your profile</strong> to
                speed up checkout.{" "}
                <Link href="/account/profile" className="font-semibold text-[var(--brand)] hover:underline">
                  Complete your delivery details
                </Link>
              </p>
            </div>
          )}
          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cta-soft text-[var(--brand)]" aria-hidden>
                <User className="size-4.5" />
              </span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Step 1</p>
                <h2 className="font-display text-lg text-foreground">Contact</h2>
                <p className="text-xs text-muted-foreground">Who we call when your water arrives.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Full name" required error={touch ? errors.name : undefined}>
                <Input
                  name="name"
                  required
                  invalid={Boolean(touch && errors.name)}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Wanjiku"
                  autoComplete="name"
                />
              </Field>
              <Field label="Phone for rider" required hint="The rider calls this number." error={touch ? errors.phone : undefined}>
                <Input
                  name="phone"
                  required
                  type="tel"
                  invalid={Boolean(touch && errors.phone)}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+254 7XX XXX XXX"
                  autoComplete="tel"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Email"
                  required={Boolean(saveProfile && profile.email)}
                  error={touch ? errors.email : undefined}
                  hint={saveProfile ? undefined : "Optional - we text you about your order."}
                >
                  <Input
                    name="email"
                    type="email"
                    invalid={Boolean(touch && errors.email)}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cta-soft text-[var(--brand)]" aria-hidden>
                {pickup ? <Store className="size-4.5" /> : <MapPin className="size-4.5" />}
              </span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Step 2</p>
                <h2 className="font-display text-lg text-foreground">
                  {pickup ? "Collection" : "Delivery"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {pickup
                    ? "Collect at the station - no delivery fee, no rider needed."
                    : "Pin the spot so the rider finds you first time."}
                </p>
              </div>
            </div>
            {pickup && station && (
              <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-semibold text-foreground">{station.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {station.city} · {station.tagline}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  We&apos;ll text you the moment your water is filled and ready to collect.
                </p>
              </div>
            )}
            {!pickup && (
            <>
            <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-[var(--brand)]"
                    aria-hidden
                  >
                    <MapPin className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {location ? "Delivering to your shared location" : "Delivery location"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[street, estate, city].filter(Boolean).join(" · ") || "No town or area set yet"}
                      {location && typeof location.accuracy === "number" && location.accuracy > 0
                        ? ` · ±${Math.round(location.accuracy)} m`
                        : ""}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={allowNewLocation}
                  disabled={locating}
                >
                  {locating ? (
                    <ButtonLoader className="size-4" />
                  ) : (
                    <Navigation className="size-4" aria-hidden />
                  )}
                  {locating ? "Locating…" : "Allow new location"}
                </Button>
              </div>
              {locationError && (
                <p className="mt-3 flex items-start gap-2 text-xs text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {locationError}
                </p>
              )}
            </div>
            <div className="mt-4">
              {location ? (
                <OrderMap
                  address={{ lat: location.lat, lng: location.lng, label: "Your delivery point" }}
                  className="h-[220px] w-full"
                />
              ) : (
                <p className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                  <MapPin className="size-4 shrink-0 text-[var(--brand)]" aria-hidden />
                  Add a pinned location so the rider finds you faster.
                </p>
              )}
            </div>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Town" required error={touch ? errors.city : undefined}>
                <Select
                  name="city"
                  invalid={Boolean(touch && errors.city)}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Estate / area"
                required
                error={touch ? errors.estate : undefined}
              >
                <Input
                  id="estate"
                  name="estate"
                  required
                  value={estate}
                  invalid={Boolean(touch && errors.estate)}
                  onChange={(e) => setEstate(e.target.value)}
                  list="estate-options"
                  placeholder="e.g. Kasarani, Nyali, Milimani…"
                  autoComplete="street-address"
                />
                <datalist id="estate-options">
                  {ESTATES.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
              </Field>
              <Field
                label="Street / road"
                required={saveProfile}
                error={touch ? errors.street : undefined}
              >
                <Input
                  name="street"
                  value={street}
                  invalid={Boolean(touch && errors.street)}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="e.g. Mwiki Road"
                  autoComplete="address-line1"
                />
              </Field>
              <Field label="Building / apartment">
                <Input name="building" value={building} onChange={(e) => setBuilding(e.target.value)} placeholder="e.g. Singa Court, Block B" />
              </Field>
              <Field label="Floor / apt no.">
                <Input name="floor" value={floor} onChange={(e) => setFloor(e.target.value)} placeholder="e.g. 3rd floor, Unit 12" />
              </Field>
              <div className="sm:col-span-2">
                <Field
                  label="Landmark / delivery directions"
                  required={saveProfile}
                  error={touch ? errors.notes : undefined}
                  hint={saveProfile ? undefined : "Call on arrival, gate on the left…"}
                >
                  <Textarea
                    name="notes"
                    invalid={Boolean(touch && errors.notes)}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Call on arrival, gate on the left, avoid the school run 3–4pm…"
                  />
                </Field>
              </div>
            </div>
            </>
            )}
          </section>

          {/* Payment method */}
          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cta-soft text-[var(--brand)]" aria-hidden>
                <ShieldCheck className="size-4.5" />
              </span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Step 3</p>
                <h2 className="font-display text-lg text-foreground">Payment</h2>
                <p className="text-xs text-muted-foreground">Money is only released when the station accepts.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <PaymentOption
                selected={method === "mpesa"}
                onSelect={() => setMethod("mpesa")}
                icon={<Smartphone className="size-5" aria-hidden />}
                title="M-Pesa"
                subtitle="STK push to your phone"
                badge="Fastest"
              />
              <PaymentOption
                selected={method === "card"}
                onSelect={() => setMethod("card")}
                icon={<CreditCard className="size-5" aria-hidden />}
                title="Card"
                subtitle="Visa & Mastercard"
              />
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              Payment is released to the station only after your order is accepted. Failed or
              rejected orders are refunded automatically. Card numbers and M-Pesa PINs are never
              stored on your profile.
            </p>
          </section>
        </div>

        {/* Summary + pay */}
        <div className="h-fit min-w-0 rounded-2xl border border-border bg-white p-6 shadow-layered lg:sticky lg:top-24">
          <h2 className="font-display text-xl text-foreground">Your order</h2>
          <SendWaterSummary className="mt-4" />
          <ul className="mt-4 space-y-2.5">
            {rows.map((r) => (
              <li
                key={`${r.line.businessId}-${r.line.productId}-${r.line.optionId ?? ""}`}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate text-muted-foreground">
                  {r.line.quantity} × {r.product!.name}
                  {r.option && (
                    <span className="block text-xs font-medium text-[var(--brand)]">{r.option.label}</span>
                  )}
                </span>
                <span className="shrink-0 font-semibold text-foreground">
                  {formatKES(r.unitPrice * r.line.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <OrderTotalsList
            totals={totals}
            pickup={pickup}
            className="mt-4 space-y-2 border-t border-border pt-4"
          />

          <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={saveProfile}
              onChange={(e) => {
                setSaveProfile(e.target.checked);
                writeConsent(e.target.checked);
              }}
              className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
              aria-describedby="profile-save-note"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Update my profile with these details</span>{" "}
              so your next checkout fills itself - name, phone, email and this delivery address.
              <span id="profile-save-note" className="block text-muted-foreground/80">
                Never saved: card numbers, M-Pesa PINs or quantities.
              </span>
            </span>
          </label>

          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={shareLocation}
              onChange={(e) => setShareLocation(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                <Navigation className="size-3.5 text-[var(--brand)]" aria-hidden /> Share my live location
              </span>{" "}
              with the delivery person so they can see and find you.
              <span className="block text-muted-foreground/80">
                Sharing stops automatically when the order is delivered, and you can turn it off from the
                tracking page.
              </span>
            </span>
          </label>

          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3">
            <input
              type="checkbox"
              checked={smsUpdates}
              onChange={(e) => setSmsUpdates(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]"
            />
            <span className="text-xs leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Text me order updates</span> - accepted, rider on
              the way, delivered, or if the station cannot fulfil it.
            </span>
          </label>

          {stationBlockers.length > 0 && (
            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-3" role="alert">
              {stationBlockers.map((b) => (
                <p key={b.businessId} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                  <span>
                    <strong>{b.businessName}:</strong> {b.reason}
                  </span>
                </p>
              ))}
            </div>
          )}
          {errors._form && (
            <p className="mt-3 text-xs font-medium text-danger" role="alert">
              {errors._form}
            </p>
          )}

          {payState === "idle" && (
            <>
              <Button
                type="submit"
                size="lg"
                className="group mt-4 w-full bg-[var(--brand)] hover:bg-[var(--cta-hover)] text-white shadow-accent"
                disabled={stationBlockers.length > 0}
              >
                {method === "mpesa" ? `Pay ${formatKES(total)} with M-Pesa` : `Pay ${formatKES(total)} by card`}
              </Button>
              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                You&apos;ll confirm on your phone
              </p>
            </>
          )}
          {(payState === "working" || payState === "awaiting-provider") && (
            <div className="mt-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ButtonLoader className="size-4 text-[var(--brand)]" />
                {payState === "working" ? "Creating your order…" : "Waiting for provider confirmation…"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {statusMessage ?? "Do not close this page - confirmation usually lands within a minute."}
              </p>
            </div>
          )}
          {payState === "stale" && (
            <div className="mt-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertCircle className="size-4 text-warning" aria-hidden /> Still processing
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {statusMessage} Your orders are saved - use the track link from your order history; it
                updates the moment payment lands.
              </p>
              <Link href="/account/orders" className="mt-3 inline-flex">
                <Button size="lg" variant="outline">
                  View my orders
                </Button>
              </Link>
            </div>
          )}
          {payState === "failed" && (
            <div className="mt-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-danger">
                <AlertCircle className="size-4" aria-hidden /> Order didn&apos;t go through
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {statusMessage ?? "Your account has not been charged."} Review the highlighted fields
                (if any) or retry the payment - retrying never duplicates your order.
              </p>
              <Button
                type="button"
                size="lg"
                className="group mt-4 w-full bg-[var(--brand)] hover:bg-[var(--cta-hover)] text-white shadow-accent"
                onClick={startPayment}
                disabled={submitting || stationBlockers.length > 0}
              >
                {method === "mpesa" ? "Retry M-Pesa payment" : "Retry card payment"}
              </Button>
            </div>
          )}
        </div>
      </form>

      {/* Mobile: the total and the pay action stay reachable without scrolling
          back up to the summary card. */}
      {payState === "idle" && (
        <div className="fixed inset-x-0 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 border-t border-border bg-white/95 px-4 pb-3 pt-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Total
              </p>
              <p className="font-display text-xl leading-tight text-foreground">
                {formatKES(total)}
              </p>
            </div>
            <button
              type="submit"
              form="checkout-form"
              disabled={stationBlockers.length > 0}
              className="shrink-0 rounded-xl bg-[var(--brand)] px-6 py-3.5 text-sm font-semibold text-white shadow-accent transition-colors hover:bg-[var(--cta-hover)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {method === "mpesa" ? "Pay with M-Pesa" : "Pay by card"}
            </button>
          </div>
        </div>
      )}

      {/* Payment overlay: status display only. Nothing here can mark an order paid. */}
      <AnimatePresence>
        {(payState === "working" || payState === "awaiting-provider") && (
          <PaymentOverlay
            phone={phone}
            amount={total}
            method={method}
            busy={submitting}
            testMode={testMode}
            statusMessage={statusMessage}
            onSimulateApprove={simulateProviderApproval}
            onRecheck={recheckPayment}
            reduce={reduce}
            transition={transition}
          />
        )}
      </AnimatePresence>
      </Container>
    </>
  );
}

function PaymentOption({
  selected,
  onSelect,
  icon,
  title,
  subtitle,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex items-center gap-3.5 rounded-xl border p-4 text-left transition-all min-h-[64px] ${
        selected
          ? "border-[var(--brand)] bg-brand/5 ring-2 ring-[var(--brand)]/20"
          : "border-border bg-white hover:border-[var(--brand)]/40"
      }`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-foreground text-white" : "bg-muted text-muted-foreground"}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {badge && (
            <span className="rounded-full bg-success-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-success">
              {badge}
            </span>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      <span
        className={`size-4 shrink-0 rounded-full border-2 ${selected ? "border-[var(--brand)] bg-transparent" : "border-border bg-white"}`}
        style={selected ? { boxShadow: "inset 0 0 0 3px white" } : undefined}
        aria-hidden
      />
    </button>
  );
}

/**
 * Status display for an in-flight provider payment. Deliberately buttonless
 * (except an honestly-labelled dev-test hook): nothing on this screen can
 * mark an order paid - only a verified provider callback can.
 */
function PaymentOverlay({
  phone,
  amount,
  method,
  busy,
  testMode,
  statusMessage,
  onSimulateApprove,
  onRecheck,
  reduce,
  transition,
}: {
  phone: string;
  amount: number;
  method: PaymentMethod;
  busy?: boolean;
  testMode?: boolean;
  statusMessage?: string | null;
  onSimulateApprove: () => void;
  onRecheck: () => void;
  reduce?: boolean;
  transition?: Transition;
}) {
  const r = reduce ?? false;
  const t = transition ?? { duration: 0.35, ease: [0.16, 1, 0.3, 1] };
  const overlayTransition: Transition = r ? { duration: 0 } : { duration: 0.2 };
  const panelTransition: Transition = r ? { duration: 0 } : t;
  const isMpesa = method === "mpesa";
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [rechecking, setRechecking] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const recheck = async () => {
    setRechecking(true);
    try {
      await onRecheck();
    } finally {
      setRechecking(false);
    }
  };

  const progress = Math.max(0, Math.min(100, (secondsLeft / 120) * 100));
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      initial={r ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={r ? { opacity: 0 } : { opacity: 0 }}
      transition={overlayTransition}
    >
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" aria-hidden />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={isMpesa ? "M-Pesa payment" : "Card payment"}
        aria-live="polite"
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-layered"
        initial={r ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={r ? { opacity: 0, y: 0, scale: 1 } : { opacity: 0, y: 16 }}
        transition={panelTransition}
      >
        <div className="bg-foreground px-6 py-5 text-white">
          <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/80">
            {isMpesa ? <Smartphone className="size-4" aria-hidden /> : <CreditCard className="size-4" aria-hidden />}{" "}
            {isMpesa ? "M-Pesa · STK push" : "Card · verifying"}
          </p>
          <p className="mt-2 font-display text-xl">
            {isMpesa ? "Confirm payment on your phone" : "Confirming your card payment"}
          </p>
        </div>

        <div className="flex flex-col items-center px-6 py-8 text-center">
          <div className="flex flex-col items-center gap-3">
            {isMpesa ? (
              <MpesaWait
                detail={`An STK push for ${formatKES(amount)} was sent to ${phone}.`}
              />
            ) : (
              <>
                <ButtonLoader className="size-10 text-[var(--brand)]" />
                <p className="text-sm text-muted-foreground">
                  Verifying <strong className="text-foreground">{formatKES(amount)}</strong> with the
                  card provider…
                </p>
              </>
            )}
            <p className="text-sm text-muted-foreground">
              {statusMessage ?? "Waiting for provider confirmation…"}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {busy ? "Placing your order…" : "Do not close this window"}
            </p>

            <div className="mt-5 w-full rounded-2xl border border-border bg-surface-2/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Time remaining
                </span>
                <span className="font-mono text-sm tabular-nums text-foreground" aria-live="off">
                  {mm}:{ss}
                </span>
              </div>
              <div
                className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border"
                role="progressbar"
                aria-label="Time remaining to confirm payment"
                aria-valuemin={0}
                aria-valuemax={120}
                aria-valuenow={secondsLeft}
              >
                <div
                  className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {secondsLeft > 0
                  ? "Check your phone for the M-Pesa prompt. Nothing is charged until you approve it."
                  : "We haven't heard back yet. Re-check the payment status - you won't be charged twice."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={recheck}
                disabled={rechecking}
              >
                {rechecking ? (
                  <ButtonLoader className="size-4" />
                ) : (
                  <RefreshCcw className="size-4" aria-hidden />
                )}
                {rechecking ? "Checking…" : "Check payment status"}
              </Button>
            </div>
            {testMode && (
              <div className="mt-2 w-full rounded-xl border border-dashed border-warning/60 bg-warning/5 p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-warning">
                  Development mode - no real charge
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Live credentials are not configured. This button fires the server&apos;s test
                  callback; production builds never show it.
                </p>
                <Button size="lg" variant="secondary" className="mt-3 w-full" onClick={onSimulateApprove}>
                  <CheckCircle2 className="size-4" aria-hidden /> Simulate provider approval
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}