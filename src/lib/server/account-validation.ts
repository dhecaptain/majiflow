import { normalizePhone } from "@/lib/server/order-store";

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
}

export interface PreferencesInput {
  orderUpdates?: boolean;
  marketing?: boolean;
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

  if ("email" in body) errors.email = "Your email is your sign-in and can't be changed here.";

  return Object.keys(errors).length > 0 ? { errors } : { profile: { name, phone } };
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
  if (Object.keys(errors).length === 0 && Object.keys(preferences).length === 0)
    errors._form = "No preferences supplied.";
  return Object.keys(errors).length > 0 ? { errors } : { preferences };
}

/** Stable identity for de-duplicating the same place saved twice. */
export function addressKey(a: { estate: string; building?: string | null; floor?: string | null }): string {
  return [a.estate, a.building ?? "", a.floor ?? ""].map((p) => p.trim().toLowerCase()).join("|");
}
