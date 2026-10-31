import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { adminKeyOk } from "@/lib/server/payments";

/**
 * Platform admin access. Server-to-server callers present MF_ADMIN_KEY as a
 * bearer token; the admin screens exchange the key once for a signed,
 * short-lived httpOnly cookie. Rotating MF_ADMIN_KEY revokes every session.
 */

export const ADMIN_COOKIE = "mf_admin";
const SESSION_MS = 12 * 60 * 60 * 1000;

function adminKey(): string | null {
  return process.env.MF_ADMIN_KEY || null;
}

function sign(key: string, issuedAt: number) {
  return createHmac("sha256", key).update(`mf-admin:${issuedAt}`).digest("hex");
}

/** Constant-time string comparison for secrets. */
export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyAdminToken(value: string | undefined | null, now = Date.now()): boolean {
  const key = adminKey();
  if (!key || !value) return false;
  const [issued, signature] = value.split(".");
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt) || !signature) return false;
  if (issuedAt > now + 60_000 || now - issuedAt > SESSION_MS) return false;
  return safeEqual(signature, sign(key, issuedAt));
}

export function issueAdminToken(now = Date.now()): string | null {
  const key = adminKey();
  return key ? `${now}.${sign(key, now)}` : null;
}

function cookieFromHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [rawName, ...rest] = part.trim().split("=");
    if (rawName === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Bearer key or a valid admin session cookie on this request. */
export function isAdminRequest(request: Request): boolean {
  if (adminKeyOk(request)) return true;
  return verifyAdminToken(cookieFromHeader(request.headers.get("cookie"), ADMIN_COOKIE));
}

/** For server components: whether the current visitor holds an admin session. */
export async function hasAdminSession(): Promise<boolean> {
  const store = await cookies();
  return verifyAdminToken(store.get(ADMIN_COOKIE)?.value);
}

/** Exchange the admin key for a session cookie. */
export async function startAdminSession(candidate: unknown): Promise<boolean> {
  const key = adminKey();
  if (!key || typeof candidate !== "string" || !safeEqual(candidate, key)) return false;
  const token = issueAdminToken();
  if (!token) return false;
  const store = await cookies();
  store.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
  return true;
}

export async function endAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}
