"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Mail,
  MapPin,
  MapPinCheck,
  Navigation,
  Pencil,
  Phone,
  Trash2,
  User,
} from "lucide-react";
import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/dialog";
import { useCustomer, type CustomerProfile } from "@/components/order/customer-provider";
import { useToast } from "@/components/ui/toast";
import { accountApi } from "@/lib/account-client";
import {
  captureLocationBestEffort,
  geolocationErrorMessage,
  geolocationUnavailableReason,
  nearestPlace,
  resolveCity,
  reverseGeocode,
  type CapturedLocation,
} from "@/lib/geo";
import type { DeliveryAddress } from "@/lib/types";
import { ButtonLoader } from "@/components/ui/button-loader";
import { SkeletonCard } from "@/components/ui/skeleton-card";

type Errors = Record<string, string>;

interface ProfileForm {
  name: string;
  phone: string;
}

function primaryAddress(profile: CustomerProfile) {
  return profile.addresses[profile.defaultAddressIndex] ?? profile.addresses[0] ?? null;
}

function savedLocation(profile: CustomerProfile): CapturedLocation | null {
  const a = primaryAddress(profile);
  if (!a || typeof a.lat !== "number" || typeof a.lng !== "number") return null;
  return { lat: a.lat, lng: a.lng, accuracy: a.accuracy, at: a.locationAt ?? "" };
}

function formatCoords(loc: CapturedLocation): string {
  return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
}

function formatWhen(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toForm(profile: CustomerProfile): ProfileForm {
  return {
    name: profile.name,
    phone: profile.phone,
  };
}

function isComplete(profile: CustomerProfile): boolean {
  const loc = savedLocation(profile);
  return Boolean(profile.name && profile.phone && profile.email && loc);
}

export function ProfilePage() {
  const { profile, hydrated, loggedIn, refreshAccount, forgetLocalAccount } = useCustomer();
  const { toast } = useToast();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [form, setForm] = useState<ProfileForm>(() => toForm(profile));
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  if (!hydrated) {
    return (
      <Container className="py-6 lg:py-8">
        <div className="space-y-4">
          <SkeletonCard variant="metric" className="h-40 w-full" />
          <div className="grid gap-4 sm:grid-cols-2">
            <SkeletonCard variant="metric" className="h-44 w-full" />
            <SkeletonCard variant="metric" className="h-44 w-full" />
          </div>
        </div>
      </Container>
    );
  }

  if (!loggedIn) {
    return (
      <Container className="py-6 lg:py-8">
        <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-border bg-white p-8 text-center shadow-card">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-radial-glow" />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-brand/10 blur-3xl"
          />
          <div className="relative">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-cta-soft text-[var(--brand)] shadow-accent">
              <User className="size-7" aria-hidden />
            </span>
            <h1 className="mt-5 font-display text-2xl text-foreground">Set up your profile</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sign in to save your delivery details and check out in two taps.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/login">
                <Button size="lg" className="w-full sm:w-auto">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Create account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  const address = primaryAddress(profile);
  const location = savedLocation(profile);
  const complete = isComplete(profile);

  const startEdit = () => {
    setForm(toForm(profile));
    setErrors({});
    setLocationError(null);
    setEditing(true);
  };

  const captureLocation = async () => {
    const reason = geolocationUnavailableReason();
    if (reason) {
      setLocationError(reason);
      return;
    }
    setLocating(true);
    setLocationError(null);
    try {
      const loc = await captureLocationBestEffort();
      const near = nearestPlace(loc.lat, loc.lng);
      const geo = await reverseGeocode(loc.lat, loc.lng, loc.accuracy);
      const estate = geo?.estate || address?.estate || near.estate || "";
      if (!estate) {
        setLocationError("We pinned you but couldn't name your estate. Add it under Addresses so riders know the area.");
        return;
      }
      const next = {
        label: address?.label ?? "Home",
        estate,
        street: geo?.street || address?.street,
        city: resolveCity(geo?.city, address?.city, near.city),
        landmark: address?.landmark,
        building: geo?.building || address?.building,
        floor: address?.floor,
        notes: address?.notes,
        phone: address?.phone || profile.phone,
        lat: loc.lat,
        lng: loc.lng,
        accuracy: loc.accuracy,
        locationAt: loc.at,
      };
      const result = address?.id
        ? await accountApi.updateAddress(address.id, next)
        : await accountApi.saveAddress({ ...next, makeDefault: true });
      if (!result.ok) {
        setLocationError(Object.values(result.fields)[0] ?? result.error);
        return;
      }
      await refreshAccount();
      toast({
        kind: "success",
        title: "Location shared",
        message: "Riders will use this pin to find you.",
      });
    } catch (err) {
      setLocationError(geolocationErrorMessage(err));
    } finally {
      setLocating(false);
    }
  };

  const validate = (): Errors => {
    const errs: Errors = {};
    const n = form.name.trim();
    if (!n || n.length < 2) errs.name = "Enter your full name.";
    else if (!/^[\p{L}\p{M}'’.\- ]+$/u.test(n) || n.length > 80)
      errs.name = "Name can only contain letters (up to 80 chars).";

    let digits = form.phone.trim().replace(/[\s()\-.]/g, "");
    if (digits.startsWith("+254")) digits = "0" + digits.slice(4);
    else if (digits.startsWith("254")) digits = "0" + digits.slice(3);
    if (!/^0\d{9}$/.test(digits))
      errs.phone = "Use a Kenyan number, e.g. 07XX XXX XXX or +254 7XX….";
    return errs;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    const first = ["name", "phone"].find((k) => errs[k]);
    if (first) {
      toast({ kind: "error", title: "A few details need fixing", message: errs[first] });
      return;
    }
    setSaving(true);
    const result = await accountApi.updateProfile({ name: form.name.trim(), phone: form.phone.trim() });
    setSaving(false);
    if (!result.ok) {
      setErrors(result.fields);
      toast({ kind: "error", title: "Couldn't save your details", message: Object.values(result.fields)[0] ?? result.error });
      return;
    }
    await refreshAccount();
    setEditing(false);
    toast({ kind: "success", title: "Profile updated", message: "Your details are saved for next time." });
  };

  const closeDelete = () => {
    if (deleting) return;
    setConfirmOpen(false);
    setPassword("");
    setDeleteError(null);
  };

  const confirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setDeleteError("Enter your password to confirm.");
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    const result = await accountApi.deleteAccount(password);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    forgetLocalAccount();
    setConfirmOpen(false);
    toast({ kind: "info", title: "Account deleted", message: "Your profile and saved details were removed." });
    router.replace("/");
    router.refresh();
  };

  return (
    <Container className="py-6 lg:py-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-card sm:p-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-radial-glow" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-brand/10 blur-3xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-foreground font-display text-xl text-white shadow-accent sm:size-16 sm:text-2xl">
              {initials(profile.name)}
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-3xl text-foreground sm:text-4xl">
                {profile.name || "Your details"}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {profile.phone || "No phone yet"}
                <span className="px-1.5 text-muted-foreground/50">·</span>
                {profile.email || "No email yet"}
              </p>
              <div className="mt-3">
                <Badge variant={complete ? "success" : "warning"}>
                  {complete ? (
                    <BadgeCheck className="size-3.5" aria-hidden />
                  ) : (
                    <AlertCircle className="size-3.5" aria-hidden />
                  )}
                  {complete ? "Profile complete" : "Incomplete profile"}
                </Badge>
              </div>
            </div>
          </div>
          {!editing && (
            <Button variant="outline" size="sm" className="group" onClick={startEdit}>
              <Pencil className="size-4" aria-hidden /> Edit
            </Button>
          )}
        </div>
      </section>

      {!complete && !editing && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--brand)]/20 bg-brand/5 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-[var(--brand)]" aria-hidden />
          <p className="text-sm text-foreground/85">
            <strong className="font-semibold text-foreground">Finish your profile.</strong> Share your
            delivery location so riders find you quickly - no manual address needed.
          </p>
        </div>
      )}

      {editing ? (
        <form onSubmit={save} className="mt-6 space-y-6" noValidate>
          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <CardHeader icon={<User className="size-4.5" aria-hidden />} title="Contact details" />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Full name" required error={errors.name}>
                <Input
                  name="name"
                  value={form.name}
                  invalid={Boolean(errors.name)}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Jane Wanjiku"
                  autoComplete="name"
                />
              </Field>
              <Field label="M-Pesa phone number" required error={errors.phone}>
                <Input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  invalid={Boolean(errors.phone)}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+254 7XX XXX XXX"
                  autoComplete="tel"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email" hint="This is how you sign in, so it can't be changed here.">
                  <Input name="email" type="email" value={profile.email ?? ""} readOnly aria-readonly />
                </Field>
              </div>
            </div>
          </section>

          <LocationCard
            location={location}
            address={address}
            locating={locating}
            error={locationError}
            onCapture={captureLocation}
          />

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" size="lg" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" className="group" disabled={saving} aria-busy={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
            <CardHeader icon={<User className="size-4.5" aria-hidden />} title="Contact details" />
            <dl className="mt-2 divide-y divide-border">
              <DetailRow icon={<User className="size-4" aria-hidden />} label="Full name" value={profile.name || "-"} />
              <DetailRow icon={<Phone className="size-4" aria-hidden />} label="Phone" value={profile.phone || "-"} />
              <DetailRow icon={<Mail className="size-4" aria-hidden />} label="Email" value={profile.email || "-"} />
            </dl>
          </section>

          <LocationCard
            location={location}
            address={address}
            locating={locating}
            error={locationError}
            onCapture={captureLocation}
          />
        </div>
      )}

      {/* Danger zone */}
      <section className="mt-8 overflow-hidden rounded-2xl border border-danger/25 bg-white shadow-card">
        <div className="flex items-center gap-2.5 border-b border-danger/15 bg-danger/10 px-6 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-danger-soft text-danger" aria-hidden>
            <Trash2 className="size-4.5" />
          </span>
          <h2 className="font-display text-lg text-danger">Delete account</h2>
        </div>
        <div className="p-6">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Permanently delete your account, saved addresses and preferences. Past orders stay with the
            stations for their records but are no longer linked to you. This signs you out.
          </p>
          <Button variant="danger" className="mt-4" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" aria-hidden /> Delete account
          </Button>
        </div>
      </section>

      <Dialog
        open={confirmOpen}
        onClose={closeDelete}
        title="Delete your account?"
        description="This permanently deletes your account and saved details. It cannot be undone."
      >
        <form onSubmit={confirmDelete} noValidate className="space-y-4">
          <Field label="Confirm with your password" required error={deleteError ?? undefined}>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              invalid={Boolean(deleteError)}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeDelete} disabled={deleting} data-autofocus>
              Keep my account
            </Button>
            <Button type="submit" variant="danger" disabled={deleting} aria-busy={deleting}>
              {deleting ? "Deleting…" : "Yes, delete my account"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Container>
  );
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-lg text-foreground">
      <span className="flex size-9 items-center justify-center rounded-lg bg-brand/10 text-[var(--brand)]" aria-hidden>
        {icon}
      </span>
      {title}
    </h2>
  );
}

function DetailRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3.5">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 truncate text-sm font-semibold text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function LocationCard({
  location,
  address,
  locating,
  error,
  onCapture,
}: {
  location: CapturedLocation | null;
  address: DeliveryAddress | null;
  locating: boolean;
  error: string | null;
  onCapture: () => void;
}) {
  const near = location ? nearestPlace(location.lat, location.lng) : null;
  const estate = address?.estate || near?.estate;
  const city = address?.city || near?.city;
  const area = [estate, city].filter(Boolean).join(", ");
  const details = [
    { label: "Area / estate", value: area || "Not detected" },
    { label: "Street / road", value: address?.street || "Not detected" },
    { label: "Building / apartment", value: address?.building || "Not detected" },
  ];
  return (
    <section className="rounded-2xl border border-border bg-white p-6 shadow-card">
      <CardHeader icon={<MapPin className="size-4.5" aria-hidden />} title="Delivery location" />
      <div className="mt-5">
        {location ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-success/25 bg-success/5 p-4">
            <div className="flex items-start gap-3">
              <span
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success"
                aria-hidden
              >
                <MapPinCheck className="size-4.5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Location shared</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {formatCoords(location)}
                  {typeof location.accuracy === "number" && location.accuracy > 0
                    ? ` · ±${Math.round(location.accuracy)} m`
                    : ""}
                </p>
                {formatWhen(location.at) && (
                  <p className="mt-0.5 text-xs text-muted-foreground/80">
                    Updated {formatWhen(location.at)}
                  </p>
                )}
                {details.length > 0 && (
                  <dl className="mt-2 space-y-0.5">
                    {details.map((d) => (
                      <div key={d.label} className="flex flex-wrap gap-x-2 text-xs">
                        <dt className="text-muted-foreground">{d.label}:</dt>
                        <dd className="font-medium text-foreground/80">{d.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={onCapture} disabled={locating}>
              {locating ? (
                <ButtonLoader className="size-4" />
              ) : (
                <Navigation className="size-4" aria-hidden />
              )}
              {locating ? "Locating…" : "Update location"}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5">
            <div className="flex items-start gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-[var(--brand)]"
                aria-hidden
              >
                <Navigation className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Share your delivery location</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Allow access and we&apos;ll pin exactly where to deliver - no manual address needed.
                </p>
              </div>
            </div>
            <Button type="button" size="sm" className="group mt-4" onClick={onCapture} disabled={locating}>
              {locating ? (
                <ButtonLoader className="size-4" />
              ) : (
                <Navigation className="size-4" aria-hidden />
              )}
              {locating ? "Getting your location…" : "Allow location access"}
            </Button>
          </div>
        )}
        {error && (
          <p className="mt-3 flex items-start gap-2 text-xs text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {error}
          </p>
        )}
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Your live location is only shared with the delivery person while an order is active.
      </p>
    </section>
  );
}
