import { and, desc, eq, gte } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { stationInterest } from "@/lib/server/db/schema";

/**
 * "Tell me when a station opens near me".
 *
 * The customer may not have an account yet, so the record keeps the number
 * and the area they asked about. Repeat requests for the same number or the
 * same station are folded into one row so a curious tap does not spam the
 * table.
 */

export interface StationInterestInput {
  userId?: string | null;
  phone?: string | null;
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
  businessId?: string | null;
}

const REPEAT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function recordStationInterest(input: StationInterestInput): Promise<void> {
  const { db } = await getDatabase();
  const phone = input.phone?.trim() || null;
  const area = input.area?.trim() || null;
  const businessId = input.businessId?.trim() || null;

  if (!phone && !input.userId) return;

  const since = new Date(Date.now() - REPEAT_WINDOW_MS);
  const matches = [gte(stationInterest.createdAt, since)];
  if (phone) matches.push(eq(stationInterest.phone, phone));
  if (businessId) matches.push(eq(stationInterest.businessId, businessId));
  if (matches.length > 1) {
    const existing = await db
      .select({ id: stationInterest.id })
      .from(stationInterest)
      .where(and(...matches))
      .limit(1);
    if (existing.length > 0) return;
  }

  await db.insert(stationInterest).values({
    userId: input.userId ?? null,
    phone,
    area,
    latitude: typeof input.lat === "number" ? input.lat : null,
    longitude: typeof input.lng === "number" ? input.lng : null,
    businessId,
  });
}

/** The most recent requests, newest first. Used by the operations view. */
export async function listStationInterest(limit = 50) {
  const { db } = await getDatabase();
  return db
    .select()
    .from(stationInterest)
    .orderBy(desc(stationInterest.createdAt))
    .limit(limit);
}
