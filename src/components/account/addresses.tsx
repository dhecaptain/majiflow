"use client";

import { useState } from "react";
import { Crosshair, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Container } from "@/components/ui/container";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, LoadingState } from "@/components/ui/feedback";
import { useCustomer } from "@/components/order/customer-provider";
import { useToast } from "@/components/ui/toast";
import { AccountError, AccountPageHeader, useAccountResource } from "@/components/account/account-ui";
import { accountApi } from "@/lib/account-client";
import type { SavedAddress } from "@/lib/account";
import { CITIES, ESTATES } from "@/lib/constants";
import {
  captureLocationBestEffort,
  type GeocodedAddress,
  geolocationErrorMessage,
  nearestPlace,
  resolveCity,
  reverseGeocode,
} from "@/lib/geo";
import type { DeliveryAddress } from "@/lib/types";

const MAX_ADDRESSES = 10;

type Draft = Pick<DeliveryAddress, "lat" | "lng" | "accuracy" | "locationAt"> & {
  label: string;
  estate: string;
  street: string;
  building: string;
  floor: string;
  city: string;
  landmark: string;
  phone: string;
  makeDefault: boolean;
};

function draftFrom(address: SavedAddress | null, phone: string): Draft {
  return {
    label: address?.label ?? "Home",
    estate: address?.estate ?? "",
    street: address?.street ?? "",
    building: address?.building ?? "",
    floor: address?.floor ?? "",
    city: address?.city ?? "Nairobi",
    landmark: address?.landmark ?? "",
    phone: address?.phone ?? phone,
    makeDefault: false,
    lat: address?.lat,
    lng: address?.lng,
    accuracy: address?.accuracy,
    locationAt: address?.locationAt,
  };
}

function AddressForm({
  editing,
  phone,
  onSaved,
  onCancel,
}: {
  editing: SavedAddress | null;
  phone: string;
  onSaved: (addresses: SavedAddress[], saved: SavedAddress) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(editing, phone));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const { toast } = useToast();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const locate = async () => {
    setLocating(true);
    try {
      const fix = await captureLocationBestEffort();
      const geo: GeocodedAddress = (await reverseGeocode(fix.lat, fix.lng, fix.accuracy)) ?? nearestPlace(fix.lat, fix.lng);
      setDraft((d) => ({
        ...d,
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        locationAt: fix.at,
        estate: d.estate || geo.estate || "",
        city: resolveCity(geo.city, d.city) ?? d.city,
        street: d.street || geo.street || "",
        building: d.building || geo.building || "",
      }));
      toast({ kind: "success", title: "Location pinned", message: "Riders will get a map pin for this address." });
    } catch (err) {
      toast({ kind: "error", title: "Couldn't get your location", message: geolocationErrorMessage(err) });
    } finally {
      setLocating(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    const result = editing ? await accountApi.updateAddress(editing.id, draft) : await accountApi.saveAddress(draft);
    setSaving(false);
    if (!result.ok) {
      setErrors({ ...result.fields, ...(Object.keys(result.fields).length ? {} : { _form: result.error }) });
      return;
    }
    onSaved(result.data.addresses, result.data.address);
  };

  return (
    <form onSubmit={submit} noValidate className="h-fit rounded-2xl border border-border bg-white p-6 shadow-card">
      <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
        {editing ? <Pencil className="size-5" aria-hidden /> : <Plus className="size-5" aria-hidden />}
        {editing ? `Edit ${editing.label}` : "Add an address"}
      </h2>
      {errors._form && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {errors._form}
        </p>
      )}
      <div className="mt-5 space-y-4">
        <Button type="button" variant="secondary" className="w-full" disabled={locating} aria-busy={locating} onClick={locate}>
          <Crosshair className="size-4" aria-hidden />
          {locating ? "Finding you…" : draft.lat !== undefined ? "Update map pin" : "Use my current location"}
        </Button>
        {draft.lat !== undefined && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Pinned at {draft.lat.toFixed(5)}, {draft.lng?.toFixed(5)}
            {draft.accuracy ? ` (±${Math.round(draft.accuracy)} m)` : ""}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Label" error={errors.label}>
            <Input value={draft.label} maxLength={40} onChange={(e) => set("label", e.target.value)} placeholder="Home, Work…" />
          </Field>
          <Field label="Town" error={errors.city}>
            <Select value={draft.city} onChange={(e) => set("city", e.target.value)}>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Estate / area" required error={errors.estate}>
          <Input
            required
            list="estate-options"
            maxLength={60}
            value={draft.estate}
            onChange={(e) => set("estate", e.target.value)}
            placeholder="e.g. South B, Nyali, Milimani…"
          />
        </Field>
        <datalist id="estate-options">
          {ESTATES.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
        <Field label="Street / road" error={errors.street}>
          <Input value={draft.street} maxLength={120} onChange={(e) => set("street", e.target.value)} placeholder="e.g. Mchumbi Rd" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Building / apartment" error={errors.building}>
            <Input value={draft.building} maxLength={60} onChange={(e) => set("building", e.target.value)} placeholder="e.g. Singa Court" />
          </Field>
          <Field label="Floor / apt no." error={errors.floor}>
            <Input value={draft.floor} maxLength={60} onChange={(e) => set("floor", e.target.value)} placeholder="e.g. 3rd floor, Unit 12" />
          </Field>
        </div>
        <Field label="Landmark" hint="Helps riders find you" error={errors.landmark}>
          <Input value={draft.landmark} maxLength={500} onChange={(e) => set("landmark", e.target.value)} placeholder="e.g. Opposite Naivas" />
        </Field>
        <Field label="Rider can call" required error={errors.phone}>
          <Input type="tel" inputMode="tel" autoComplete="tel" value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder="07XX XXX XXX" />
        </Field>
        {!editing?.isDefault && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-5 accent-[var(--brand)]"
              checked={draft.makeDefault}
              onChange={(e) => set("makeDefault", e.target.checked)}
            />
            Use as my default delivery address
          </label>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {editing && (
            <Button type="button" variant="secondary" size="lg" className="sm:flex-1" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="lg" className="sm:flex-1" disabled={saving} aria-busy={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Save address"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function AddressesPage() {
  const { profile, refreshAccount } = useCustomer();
  const { toast } = useToast();
  const { resource, reload, replace } = useAccountResource("addresses", accountApi.addresses);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [removing, setRemoving] = useState<SavedAddress | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const addresses = resource.status === "ready" ? resource.data.addresses : [];
  const full = addresses.length >= MAX_ADDRESSES;

  const sync = (next: SavedAddress[]) => {
    replace({ addresses: next });
    void refreshAccount();
  };

  const makeDefault = async (address: SavedAddress) => {
    setBusyId(address.id);
    const result = await accountApi.makeDefaultAddress(address.id);
    setBusyId(null);
    if (!result.ok) return toast({ kind: "error", title: "Couldn't change default", message: result.error });
    sync(result.data.addresses);
    toast({ kind: "info", title: "Default changed", message: `${address.estate} is now your default delivery address.` });
  };

  const remove = async () => {
    if (!removing) return;
    setBusyId(removing.id);
    const result = await accountApi.deleteAddress(removing.id);
    setBusyId(null);
    const name = removing.estate;
    setRemoving(null);
    if (!result.ok) return toast({ kind: "error", title: "Couldn't remove address", message: result.error });
    if (editing?.id === removing.id) setEditing(null);
    sync(result.data.addresses);
    toast({ kind: "success", title: "Address removed", message: `${name} was removed from your account.` });
  };

  return (
    <Container className="py-6 lg:py-8">
      <AccountPageHeader
        eyebrow={
          <>
            <MapPin className="size-3.5 text-[var(--brand)]" aria-hidden /> Saved addresses
          </>
        }
        title="Delivery locations"
      />

      <div className="grid gap-8 lg:grid-cols-2">
        {full && !editing ? (
          <div className="h-fit rounded-2xl border border-dashed border-border bg-white p-6 text-sm text-muted-foreground">
            You&apos;ve saved {MAX_ADDRESSES} addresses, the maximum. Remove one to add another.
          </div>
        ) : (
          <AddressForm
            key={editing ? `edit-${editing.id}` : `new-${formKey}`}
            editing={editing}
            phone={profile.phone}
            onCancel={() => setEditing(null)}
            onSaved={(next, saved) => {
              sync(next);
              toast({
                kind: "success",
                title: editing ? "Address updated" : "Address saved",
                message: `${saved.estate} is ready at checkout.`,
              });
              setEditing(null);
              setFormKey((k) => k + 1);
            }}
          />
        )}

        <section aria-labelledby="saved-places">
          <h2 id="saved-places" className="font-display text-lg text-foreground">
            Your saved places
          </h2>
          <div className="mt-4">
            {resource.status === "loading" ? (
              <LoadingState label="Loading addresses…" />
            ) : resource.status === "error" ? (
              <AccountError message={resource.error} code={resource.code} onRetry={reload} />
            ) : addresses.length === 0 ? (
              <EmptyState
                icon={<MapPin className="size-7" aria-hidden />}
                title="No saved addresses"
                description="Add your estate and building to make checkout a two-tap job."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {addresses.map((a) => (
                  <li key={a.id} className="rounded-2xl border border-border bg-white p-5 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <MapPin className="size-4 text-[var(--brand)]" aria-hidden />
                          <p className="font-semibold text-foreground">
                            {a.label} · {a.estate}
                          </p>
                          {a.isDefault && <Badge variant="success">Default</Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {[a.street, a.building, a.floor, a.city].filter(Boolean).join(" · ")}
                        </p>
                        {a.landmark && <p className="mt-0.5 text-xs text-muted-foreground">Near {a.landmark}</p>}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {a.phone}
                          {a.lat !== undefined && " · Map pin saved"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${a.label} address in ${a.estate}`}
                          onClick={() => setEditing(a)}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-danger"
                          aria-label={`Remove ${a.label} address in ${a.estate}`}
                          disabled={busyId === a.id}
                          onClick={() => setRemoving(a)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                    {!a.isDefault && (
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-2 min-h-11 px-0"
                        disabled={busyId === a.id}
                        onClick={() => makeDefault(a)}
                      >
                        <Star className="size-3.5" aria-hidden /> Make default
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <Dialog
        open={removing !== null}
        onClose={() => busyId === null && setRemoving(null)}
        title="Remove this address?"
        description={removing ? `${removing.label} · ${removing.estate} will no longer be offered at checkout.` : undefined}
      >
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={busyId !== null} onClick={() => setRemoving(null)}>
            Keep it
          </Button>
          <Button variant="danger" disabled={busyId !== null} aria-busy={busyId !== null} onClick={remove}>
            {busyId !== null ? "Removing…" : "Remove"}
          </Button>
        </div>
      </Dialog>
    </Container>
  );
}
