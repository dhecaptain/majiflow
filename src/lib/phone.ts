/**
 * Kenyan phone numbers, in one place.
 *
 * MajiFlow stores customer numbers in the local form (07XXXXXXXXX / 01XXXXXXXXX)
 * because that is what the rider dials, and it talks to SMS providers in E.164
 * (254XXXXXXXXX). These helpers are pure so the signup sheet, the order store
 * and the server routes cannot disagree about what "the same number" means.
 */

export const KENYA_COUNTRY_CODE = "254";

/** Local Kenyan mobile numbers: 07XXXXXXXXX or 01XXXXXXXXX. */
const LOCAL_MOBILE = /^0[17]\d{8}$/;

/** Any Kenyan local number we accept (07…, 01…). */
const LOCAL_ANY = /^0\d{9}$/;

/**
 * Reduce a number the customer typed to the canonical local form.
 *
 * Accepts `+254…`, `254…`, `0…` and bare `7…`/`1…` in any spacing.
 * Returns null for anything that is not a Kenyan number.
 */
export function normalizeKenyanPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/[\s()\-.]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (!/^\d+$/.test(digits)) return null;

  if (digits.startsWith("254")) {
    digits = `0${digits.slice(3)}`;
  } else if (digits.startsWith("0")) {
    // already local
  } else if (digits.length === 9 && (digits.startsWith("7") || digits.startsWith("1"))) {
    digits = `0${digits}`;
  }

  return LOCAL_ANY.test(digits) ? digits : null;
}

/** True when the number is a Kenyan *mobile* line (07… or 01…), not a landline. */
export function isKenyanMobile(value: unknown): boolean {
  const local = normalizeKenyanPhone(value);
  return local !== null && LOCAL_MOBILE.test(local);
}

/** E.164 form (254XXXXXXXXX) for SMS providers. */
export function toE164(value: unknown): string | null {
  const local = normalizeKenyanPhone(value);
  return local ? `${KENYA_COUNTRY_CODE}${local.slice(1)}` : null;
}

/** Human-readable grouping: 0712 345 678. */
export function formatKenyanPhone(value: unknown): string {
  const local = normalizeKenyanPhone(value);
  if (!local) return "";
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}

/** A short, non-identifying hint for UI copy, e.g. "+254 ••• ••• 678". */
export function maskKenyanPhone(value: unknown): string {
  const local = normalizeKenyanPhone(value);
  if (!local) return "";
  return `+${KENYA_COUNTRY_CODE} ••• ••• ${local.slice(-3)}`;
}
