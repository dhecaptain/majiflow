import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { rateLimits } from "@/lib/server/db/schema";
import { reportFailure } from "@/lib/monitoring";

/**
 * Request limits that hold across every server instance and restart: the
 * counters live in Postgres (`rate_limits`). Without a database (local
 * development, tests) they fall back to this process's memory.
 */

export interface Limit {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

export interface LimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

/** Keys are hashed so phone numbers and addresses never sit in the table as-is. */
function storageKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

const memory = new Map<string, { windowStart: number; count: number }>();

function memoryHit(key: string, { limit, windowMs }: Limit, now: number): LimitResult {
  const entry = memory.get(key);
  const current = entry && now - entry.windowStart < windowMs ? entry : { windowStart: now, count: 0 };
  current.count += 1;
  memory.set(key, current);
  if (memory.size > 10_000) memory.clear();
  return {
    ok: current.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((current.windowStart + windowMs - now) / 1000)),
  };
}

/** Count one request against `key` and say whether it is still within the limit. */
export async function hit(key: string, rule: Limit, now = Date.now()): Promise<LimitResult> {
  const hashed = storageKey(key);
  if (!process.env.DATABASE_URL?.trim()) return memoryHit(hashed, rule, now);
  try {
    const { db } = await getDatabase();
    const windowStart = new Date(now);
    const expired = new Date(now - rule.windowMs);
    // One atomic upsert: a fresh window resets the count, otherwise it grows.
    const [row] = await db
      .insert(rateLimits)
      .values({ key: hashed, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.windowStart} < ${expired} then 1 else ${rateLimits.count} + 1 end`,
          windowStart: sql`case when ${rateLimits.windowStart} < ${expired} then ${windowStart} else ${rateLimits.windowStart} end`,
        },
      })
      .returning({ count: rateLimits.count, windowStart: rateLimits.windowStart });
    const started = row.windowStart.getTime();
    return {
      ok: row.count <= rule.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((started + rule.windowMs - now) / 1000)),
    };
  } catch (error) {
    // A broken limiter must not take sign-in down with it; fall back and alert.
    await reportFailure("store", "Rate limiter unavailable; using in-process limits.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return memoryHit(hashed, rule, now);
  }
}

/**
 * The caller's address. On Vercel `x-real-ip` / `x-forwarded-for` are set by
 * the platform, not the client; the first hop is used elsewhere.
 */
export function clientIp(request: Request): string {
  const headers = request.headers;
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Common limits, per caller address unless noted. */
export const LIMITS = {
  otpRequestPerPhone: { limit: 5, windowMs: 10 * 60_000 },
  otpRequestPerIp: { limit: 20, windowMs: 10 * 60_000 },
  otpVerifyPerPhone: { limit: 10, windowMs: 10 * 60_000 },
  otpVerifyPerIp: { limit: 30, windowMs: 10 * 60_000 },
  loginPerIp: { limit: 20, windowMs: 10 * 60_000 },
  loginPerAccount: { limit: 10, windowMs: 10 * 60_000 },
  registerPerIp: { limit: 10, windowMs: 60 * 60_000 },
  adminSessionPerIp: { limit: 10, windowMs: 10 * 60_000 },
  paymentPerIp: { limit: 20, windowMs: 10 * 60_000 },
  geocodePerIp: { limit: 60, windowMs: 60_000 },
  formPerIp: { limit: 10, windowMs: 10 * 60_000 },
} satisfies Record<string, Limit>;

/**
 * Check every given key; answer 429 (with Retry-After) when any is over its
 * limit, or null when the request may go ahead.
 */
export async function limitResponse(checks: { key: string; rule: Limit }[]): Promise<Response | null> {
  for (const { key, rule } of checks) {
    const result = await hit(key, rule);
    if (!result.ok) {
      return Response.json(
        { error: "Too many requests. Please wait a moment and try again.", code: "rate" },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } }
      );
    }
  }
  return null;
}

/** Drop counters whose window ended long ago. Called from the daily cron. */
export async function pruneRateLimits(now = Date.now()): Promise<number> {
  if (!process.env.DATABASE_URL?.trim()) return 0;
  const { db } = await getDatabase();
  const removed = await db
    .delete(rateLimits)
    .where(lt(rateLimits.windowStart, new Date(now - 24 * 60 * 60_000)))
    .returning({ key: rateLimits.key });
  return removed.length;
}
