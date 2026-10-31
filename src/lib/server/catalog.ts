import { cache } from "react";
import { unstable_cache } from "next/cache";
import { eq } from "drizzle-orm";
import { businesses as demoStations } from "@/lib/data/businesses";
import { getDatabase } from "@/lib/server/db";
import { businessApplications, businesses, subscriptions } from "@/lib/server/db/schema";
import { productsForStations } from "@/lib/server/station-products";
import {
  mapDatabaseBusinessToPublic,
  queryEligiblePublishedDatabaseBusinesses,
  storefrontMissingFields,
} from "@/lib/server/station-publication";
import { parseWeeklyHours } from "@/lib/business-hours";
import type { Business } from "@/lib/types";

/**
 * The public station catalog: every station a customer can browse and order
 * from. Stations come from the database (published, approved, subscribed and
 * with hours and at least one visible product). The seeded demo stations in
 * `src/lib/data/businesses.ts` join them only when demo stations are enabled,
 * which is never the case in production unless `MF_DEMO_STATIONS=1`.
 */

export const STATIONS_CACHE_TAG = "stations";

/** Demo stations: on in development and tests, off in production unless MF_DEMO_STATIONS=1. */
export function demoStationsEnabled(): boolean {
  const flag = process.env.MF_DEMO_STATIONS?.trim();
  if (flag === "1") return true;
  if (flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Published stations that are ready to take orders, with their visible products. */
async function loadDatabaseStations(now = new Date()): Promise<Business[]> {
  if (!databaseConfigured()) return [];
  const rows = await queryEligiblePublishedDatabaseBusinesses(now);
  const products = await productsForStations(rows.map((row) => row.business.id));
  return rows
    .map(({ business, application, subscription }) =>
      mapDatabaseBusinessToPublic(business, application, subscription, products.get(business.id) ?? [])
    )
    .filter(
      (station) =>
        storefrontMissingFields({
          openingHours: station.openingHours,
          visibleProductCount: station.products.length,
        }).length === 0
    );
}

/** Database stations first; demo stations fill in only when enabled and never shadow a real slug. */
async function loadStations(): Promise<Business[]> {
  const fromDatabase = await loadDatabaseStations();
  if (!demoStationsEnabled()) return fromDatabase;
  const taken = new Set(fromDatabase.map((station) => station.slug));
  return [...fromDatabase, ...demoStations.filter((station) => !taken.has(station.slug))];
}

/**
 * Cached across requests for a short while (and refreshed at once when an
 * owner changes their station - see `revalidateStations`). Outside the Next
 * runtime (tests, scripts) the catalog is read directly.
 */
const cachedStations = process.env.NEXT_RUNTIME
  ? unstable_cache(loadStations, ["public-stations"], { revalidate: 60, tags: [STATIONS_CACHE_TAG] })
  : loadStations;

/** Every station customers can browse. Throws when the database is configured but unreachable. */
export const listStations = cache(async (): Promise<Business[]> => cachedStations());

export async function getStationBySlug(slug: string): Promise<Business | null> {
  return (await listStations()).find((station) => station.slug === slug) ?? null;
}

/**
 * The station an order is placed with, read fresh (never from the cache) so
 * checkout always validates against current prices, stock and hours.
 */
export async function getOrderableStation(id: string): Promise<Business | null> {
  if (demoStationsEnabled()) {
    const demo = demoStations.find((station) => station.id === id);
    if (demo) return demo;
  }
  if (!databaseConfigured() || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const station = (await loadDatabaseStations()).find((candidate) => candidate.id === id);
  return station ?? null;
}

/**
 * The owner's own stations for the dashboard, published or not, with every
 * product including hidden ones. Demo stations an owner was linked to before
 * real catalogs existed are included while demo stations are enabled.
 */
export async function listOwnerCatalogStations(ownerUserId: string): Promise<Business[]> {
  const { db } = await getDatabase();
  const rows = await db
    .select({ business: businesses, application: businessApplications, subscription: subscriptions })
    .from(businesses)
    .innerJoin(businessApplications, eq(businesses.applicationId, businessApplications.id))
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .where(eq(businesses.ownerUserId, ownerUserId));

  const demoBySlug = new Map(demoStationsEnabled() ? demoStations.map((s) => [s.slug, s]) : []);
  const own = rows.filter(({ business }) => !demoBySlug.has(business.slug));
  const products = await productsForStations(own.map((row) => row.business.id), { includeHidden: true });

  return rows.map(({ business, application, subscription }) => {
    const demo = demoBySlug.get(business.slug);
    if (demo) return demo;
    const station = mapDatabaseBusinessToPublic(business, application, subscription, products.get(business.id) ?? []);
    return { ...station, openingHours: parseWeeklyHours(business.openingHours) ?? undefined };
  });
}

/** Refresh the public catalog after an owner changes their listing or products. */
export async function revalidateStations() {
  if (!process.env.NEXT_RUNTIME) return;
  const { revalidateTag } = await import("next/cache");
  revalidateTag(STATIONS_CACHE_TAG, { expire: 0 });
}
