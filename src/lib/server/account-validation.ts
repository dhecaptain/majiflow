import { normalizePhone } from "@/lib/server/order-store";
import type { FulfillmentMethod } from "@/lib/types";

/**
 * Validation for customer-account writes. Every function takes untrusted JSON
 * and returns either clean values or human-readable per-field errors.
 */

export type FieldErrors = Record<string, string>;

export interface AddressInput {
  label: string;
  estate: string;
  street: string | null;
  building: string | null;
  floor: string | null;
  city: string | null;
  landmark: string | null;
  notes: string | null;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  locationAt: Date | null;
  makeDefault: boolean;
}

export interface ProfileInput {
  name: string;
  phone: string | null;
  /** Only set for phone-first customers who have no email yet. */
  email?: string;
}

export interface PreferencesInput {
  orderUpdates?: boolean;
  marketing?: boolean;
  fulfilment?: FulfillmentMethod;
  lastStationId?: string | null;
}

const NAME_RE = /^[\p{L}\p{M}'’.\- ]+$/u;

function record(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : null;
}

function optionalText(value: unknown, max: number, field: string, errors: FieldErrors): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    errors[field] = "Must be text.";
    return null;
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length > max) errors[field] = `Keep this under ${max} characters.`;
  return trimmed || null;
}

function optionalNumber(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

export function validateAddressInput(
  input: unknown,
  fallbackPhone: string | null
): { address: AddressInput } | { errors: FieldErrors } {
  const body = record(input);
  if (!body) return { errors: { _form: "Missing address details." } };
  const errors: FieldErrors = {};

  const estate = optionalText(body.estate, 60, "estate", errors);
  if (!estate && !errors.estate) errors.estate = "Choose the estate or area riders should head to.";

  const label = optionalText(body.label, 40, "label", errors) ?? "Home";

  const rawPhone = typeof body.phone === "string" && body.phone.trim() ? body.phone : fallbackPhone;
  const phone = normalizePhone(rawPhone);
  if (!phone) errors.phone = "Add the Kenyan number the rider should call, e.g. 07XX XXX XXX.";

  const latitude = optionalNumber(body.lat, -90, 90);
  const longitude = optionalNumber(body.lng, -180, 180);
  if ((latitude === null) !== (longitude === null)) errors.location = "Location needs both latitude and longitude.";

  const locationAtRaw = typeof body.locationAt === "string" ? Date.parse(body.locationAt) : NaN;

  const address: AddressInput = {
    label,
    estate: estate ?? "",
    street: optionalText(body.street, 120, "street", errors),
    building: optionalText(body.building, 60, "building", errors),
    floor: optionalText(body.floor, 60, "floor", errors),
    city: optionalText(body.city, 40, "city", errors),
    landmark: optionalText(body.landmark, 500, "landmark", errors),
    notes: optionalText(body.notes, 500, "notes", errors),
    phone: phone ?? "",
    latitude,
    longitude,
    accuracy: latitude === null ? null : optionalNumber(body.accuracy, 0, 100_000),
    locationAt: latitude === null || Number.isNaN(locationAtRaw) ? null : new Date(locationAtRaw),
    makeDefault: body.makeDefault === true,
  };

  return Object.keys(errors).length > 0 ? { errors } : { address };
}

export function validateProfileInput(input: unknown): { profile: ProfileInput } | { errors: FieldErrors } {
  const body = record(input);
  if (!body) return { errors: { _form: "Missing profile details." } };
  const errors: FieldErrors = {};

  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2) errors.name = "Enter your full name.";
  else if (name.length > 80 || !NAME_RE.test(name)) errors.name = "Name can only contain letters (up to 80 chars).";

  let phone: string | null = null;
  if (typeof body.phone === "string" && body.phone.trim()) {
    phone = normalizePhone(body.phone);
    if (!phone) errors.phone = "Use a Kenyan number, e.g. 07XX XXX XXX or +254 7XX….";
  } else if (body.phone !== undefined && body.phone !== null && body.phone !== "") {
    errors.phone = "Use a Kenyan number, e.g. 07XX XXX XXX or +254 7XX….";
  }

  // A phone-first customer may add an email once. Changing an email that is
  // already in use is refused by the account service, which knows the history.
  let email: string | undefined;
  if (body.email !== undefined && body.email !== null && body.email !== "") {
    if (typeof body.email !== "string") {
      errors.email = "Use a valid email address.";
    } else {
      const trimmed = body.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        errors.email = "Use a valid email address.";
      } else {
        email = trimmed;
      }
    }
  }

  return Object.keys(errors).length > 0 ? { errors } : { profile: { name, phone, ...(email ? { email } : {}) } };
}

export function validatePreferencesInput(input: unknown): { preferences: PreferencesInput } | { errors: FieldErrors } {
  const body = record(input);
  if (!body) return { errors: { _form: "Missing preferences." } };
  const preferences: PreferencesInput = {};
  const errors: FieldErrors = {};
  for (const key of ["orderUpdates", "marketing"] as const) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "boolean") errors[key] = "Must be on or off.";
    else preferences[key] = body[key] as boolean;
  }
  if (body.fulfilment !== undefined) {
    if (body.fulfilment === "delivery" || body.fulfilment === "pickup") preferences.fulfilment = body.fulfilment;
    else errors.fulfilment = "Choose delivery or pickup.";
  }
  if (body.lastStationId !== undefined) {
    if (body.lastStationId === null || body.lastStationId === "") {
      preferences.lastStationId = null;
    } else if (typeof body.lastStationId === "string" && body.lastStationId.trim().length <= 180) {
      preferences.lastStationId = body.lastStationId.trim() || null;
    } else {
      errors.lastStationId = "Use a valid station id.";
    }
  }
  if (Object.keys(errors).length === 0 && Object.keys(preferences).length === 0)
    errors._form = "No preferences supplied.";
  return Object.keys(errors).length > 0 ? { errors } : { preferences };
}

type StoredAddressFields = Omit<AddressInput, "makeDefault">;

/**
 * Re-saving a place that already exists (checkout does this after every order)
 * must only add detail: the stored label and spelling stay, blank fields keep
 * their saved values, and the map pin is replaced only by a new one.
 */
export function mergeAddressInput(stored: StoredAddressFields, input: AddressInput): StoredAddressFields {
  const hasPin = input.latitude !== null && input.longitude !== null;
  return {
    label: stored.label,
    estate: stored.estate,
    building: stored.building ?? input.building,
    floor: stored.floor ?? input.floor,
    street: input.street ?? stored.street,
    city: input.city ?? stored.city,
    landmark: input.landmark ?? stored.landmark,
    notes: input.notes ?? stored.notes,
    phone: input.phone || stored.phone,
    latitude: hasPin ? input.latitude : stored.latitude,
    longitude: hasPin ? input.longitude : stored.longitude,
    accuracy: hasPin ? input.accuracy : stored.accuracy,
    locationAt: hasPin ? input.locationAt : stored.locationAt,
  };
}

/** Stable identity for de-duplicating the same place saved twice. */
export function addressKey(a: { estate: string; building?: string | null; floor?: string | null }): string {
  return [a.estate, a.building ?? "", a.floor ?? ""].map((p) => p.trim().toLowerCase()).join("|");
}
