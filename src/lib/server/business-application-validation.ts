import type { PlanName } from "@/lib/types";

export interface BusinessApplicationInput {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  deliveryFee: string | number;
  deliveryTimeMinutes: string | number;
  plan: string;
  description?: string;
  registrationNumber?: string;
  zones?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
}

export interface ValidatedBusinessApplication {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  deliveryFee: number;
  deliveryTimeMinutes: number;
  plan: PlanName;
  description: string | null;
  registrationNumber: string | null;
  zones: string | null;
  latitude: number | null;
  longitude: number | null;
}

export type BusinessApplicationValidation =
  | { success: true; data: ValidatedBusinessApplication }
  | { success: false; errors: Record<string, string> };

const plans = new Set<PlanName>(["starter", "growth", "pro"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function required(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function validateBusinessApplication(
  input: unknown
): BusinessApplicationValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { success: false, errors: { _form: "Application payload must be an object" } };
  }
  const values = input as Partial<BusinessApplicationInput>;
  const errors: Record<string, string> = {};
  const businessName = required(values.businessName) ? values.businessName.trim() : "";
  const ownerName = required(values.ownerName) ? values.ownerName.trim() : "";
  const phone = required(values.phone) ? values.phone.trim() : "";
  const email = required(values.email) ? values.email.trim().toLowerCase() : "";
  const address = required(values.address) ? values.address.trim() : "";
  const city = required(values.city) ? values.city.trim() : "";
  const deliveryFee = finiteNumber(values.deliveryFee);
  const deliveryTimeMinutes = finiteNumber(values.deliveryTimeMinutes);
  const latitude = values.latitude == null || values.latitude === "" ? null : finiteNumber(values.latitude);
  const longitude = values.longitude == null || values.longitude === "" ? null : finiteNumber(values.longitude);

  if (!businessName) errors.businessName = "Business name is required";
  if (!ownerName) errors.ownerName = "Owner name is required";
  if (!phone) errors.phone = "Phone is required";
  if (!email) errors.email = "Email is required";
  else if (!emailPattern.test(email)) errors.email = "Email is invalid";
  if (!address) errors.address = "Address is required";
  if (!city) errors.city = "City is required";
  if (deliveryFee == null || deliveryFee < 0 || deliveryFee > 99_999_999.99)
    errors.deliveryFee = "Delivery fee is invalid";
  if (
    deliveryTimeMinutes == null ||
    !Number.isInteger(deliveryTimeMinutes) ||
    deliveryTimeMinutes <= 0 ||
    deliveryTimeMinutes > 1_440
  )
    errors.deliveryTimeMinutes = "Delivery time is invalid";
  if (!plans.has(values.plan as PlanName)) errors.plan = "Plan is invalid";
  if ((latitude == null) !== (longitude == null)) errors.location = "Latitude and longitude are both required";
  if (latitude != null && (latitude < -90 || latitude > 90)) errors.latitude = "Latitude is invalid";
  if (longitude != null && (longitude < -180 || longitude > 180)) errors.longitude = "Longitude is invalid";

  if (Object.keys(errors).length > 0) return { success: false, errors };
  if (deliveryFee === null || deliveryTimeMinutes === null) {
    return { success: false, errors: { deliveryFee: "Delivery fee is invalid" } };
  }

  return {
    success: true,
    data: {
      businessName,
      ownerName,
      phone,
      email,
      address,
      city,
      deliveryFee: Number(deliveryFee.toFixed(2)),
      deliveryTimeMinutes,
      plan: values.plan as PlanName,
      description: optionalText(values.description),
      registrationNumber: optionalText(values.registrationNumber),
      zones: optionalText(values.zones),
      latitude,
      longitude,
    },
  };
}
