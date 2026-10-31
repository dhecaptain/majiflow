/**
 * One-time passwords for phone-first sign-up and sign-in.
 *
 * Codes live in the database, never in memory and never in plain text: only an
 * HMAC of the code is stored, so a leaked table does not hand over live
 * sign-in codes. Each phone/purpose pair keeps at most one live code - asking
 * for a new one retires the previous one.
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull, lt } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { authOtpCodes } from "@/lib/server/db/schema";

export const OTP_CODE_LENGTH = 6;
export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/** How many codes one caller may ask for in this window. */
const OTP_REQUEST_WINDOW_MS = 10 * 60 * 1000;
const OTP_REQUEST_LIMIT = 5;

export type OtpPurpose = "register" | "login";

export type OtpErrorCode = "invalid" | "expired" | "attempts" | "cooldown" | "rate";

export class OtpError extends Error {
  readonly code: OtpErrorCode;
  constructor(code: OtpErrorCode, message: string) {
    super(message);
    this.name = "OtpError";
    this.code = code;
  }
}

const MESSAGES: Record<OtpErrorCode, string> = {
  invalid: "That code is not right. Check it and try again.",
  expired: "That code has expired. Ask for a new one.",
  attempts: "Too many tries. Ask for a new code.",
  cooldown: "Wait a moment before asking for another code.",
  rate: "Too many requests. Try again in a minute.",
};

export function otpErrorMessage(code: OtpErrorCode): string {
  return MESSAGES[code];
}

function secret(): string {
  // A stable secret keeps codes valid across restarts and instances.
  return process.env.MF_OTP_SECRET?.trim() || "majiflow-development-otp-secret";
}

export function hashOtpCode(code: string, phone: string): string {
  return createHmac("sha256", secret()).update(`${phone}:${code}`).digest("hex");
}

export function generateOtpCode(): string {
  return randomInt(0, 10 ** OTP_CODE_LENGTH).toString().padStart(OTP_CODE_LENGTH, "0");
}

function sameCode(expectedHash: string, code: string, phone: string): boolean {
  const actual = Buffer.from(hashOtpCode(code, phone), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** In-memory throttle on how many codes a single caller may ask for. */
const requestLog = new Map<string, number[]>();

export function checkOtpRequestRate(key: string, now = Date.now()): void {
  const recent = (requestLog.get(key) ?? []).filter((at) => now - at < OTP_REQUEST_WINDOW_MS);
  if (recent.length >= OTP_REQUEST_LIMIT) {
    requestLog.set(key, recent);
    throw new OtpError("rate", MESSAGES.rate);
  }
  recent.push(now);
  requestLog.set(key, recent);
  if (requestLog.size > 5000) requestLog.clear();
}

export interface IssuedOtp {
  /** Plain code, only ever returned to the caller that will send the text. */
  code: string;
  expiresAt: Date;
  /** Seconds the customer must wait before asking for another code. */
  resendAfterSeconds: number;
}

/**
 * Create a fresh code for a phone number and retire any earlier one.
 * Throws `OtpError("cooldown")` when the customer asks too quickly.
 */
export async function issueOtp(phone: string, purpose: OtpPurpose, now = new Date()): Promise<IssuedOtp> {
  const { db } = await getDatabase();
  const live = await db
    .select({ id: authOtpCodes.id, createdAt: authOtpCodes.createdAt })
    .from(authOtpCodes)
    .where(
      and(
        eq(authOtpCodes.phone, phone),
        eq(authOtpCodes.purpose, purpose),
        isNull(authOtpCodes.consumedAt)
      )
    )
    .orderBy(desc(authOtpCodes.createdAt))
    .limit(1);

  const previous = live[0];
  if (previous) {
    const elapsed = now.getTime() - previous.createdAt.getTime();
    if (elapsed < OTP_RESEND_COOLDOWN_MS) {
      throw new OtpError("cooldown", MESSAGES.cooldown);
    }
    await db
      .update(authOtpCodes)
      .set({ consumedAt: now })
      .where(eq(authOtpCodes.id, previous.id));
  }

  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MS);
  await db.insert(authOtpCodes).values({
    phone,
    codeHash: hashOtpCode(code, phone),
    purpose,
    expiresAt,
  });

  return {
    code,
    expiresAt,
    resendAfterSeconds: Math.ceil(OTP_RESEND_COOLDOWN_MS / 1000),
  };
}

/**
 * Check a code the customer typed. Throws `OtpError` with a code the UI can
 * turn into a specific message.
 */
export async function verifyOtp(phone: string, code: string, purpose: OtpPurpose, now = new Date()): Promise<void> {
  const trimmed = code.trim();
  if (!/^\d{6}$/.test(trimmed)) {
    throw new OtpError("invalid", MESSAGES.invalid);
  }

  const { db } = await getDatabase();
  const [row] = await db
    .select()
    .from(authOtpCodes)
    .where(
      and(
        eq(authOtpCodes.phone, phone),
        eq(authOtpCodes.purpose, purpose),
        isNull(authOtpCodes.consumedAt)
      )
    )
    .orderBy(desc(authOtpCodes.createdAt))
    .limit(1);

  if (!row) {
    throw new OtpError("invalid", MESSAGES.invalid);
  }

  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.update(authOtpCodes).set({ consumedAt: now }).where(eq(authOtpCodes.id, row.id));
    throw new OtpError("expired", MESSAGES.expired);
  }

  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    await db.update(authOtpCodes).set({ consumedAt: now }).where(eq(authOtpCodes.id, row.id));
    throw new OtpError("attempts", MESSAGES.attempts);
  }

  if (!sameCode(row.codeHash, trimmed, phone)) {
    await db
      .update(authOtpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(authOtpCodes.id, row.id));
    const left = OTP_MAX_ATTEMPTS - (row.attempts + 1);
    if (left <= 0) {
      await db.update(authOtpCodes).set({ consumedAt: now }).where(eq(authOtpCodes.id, row.id));
      throw new OtpError("attempts", MESSAGES.attempts);
    }
    throw new OtpError("invalid", MESSAGES.invalid);
  }

  await db.update(authOtpCodes).set({ consumedAt: now }).where(eq(authOtpCodes.id, row.id));
}

/** True when the phone still has a live, unexpired code. */
export async function hasLiveOtp(phone: string, purpose: OtpPurpose, now = new Date()): Promise<boolean> {
  const { db } = await getDatabase();
  const [row] = await db
    .select({ id: authOtpCodes.id })
    .from(authOtpCodes)
    .where(
      and(
        eq(authOtpCodes.phone, phone),
        eq(authOtpCodes.purpose, purpose),
        isNull(authOtpCodes.consumedAt),
        gt(authOtpCodes.expiresAt, now)
      )
    )
    .limit(1);
  return Boolean(row);
}

/** Remove codes that can no longer be used. Called opportunistically. */
export async function pruneOtpCodes(now = new Date()): Promise<number> {
  const { db } = await getDatabase();
  const stale = await db
    .select({ id: authOtpCodes.id })
    .from(authOtpCodes)
    .where(lt(authOtpCodes.expiresAt, now))
    .limit(500);
  if (!stale.length) return 0;
  await db.delete(authOtpCodes).where(
    and(...stale.map((row) => eq(authOtpCodes.id, row.id)))
  );
  return stale.length;
}
