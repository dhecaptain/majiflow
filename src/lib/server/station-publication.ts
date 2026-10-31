import { and, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { businesses, businessApplications, subscriptions } from "@/lib/server/db/schema";
import { evaluateSubscriptionEligibility, type SubscriptionRecord } from "@/lib/server/subscriptions";
import { parseWeeklyHours } from "@/lib/business-hours";
import { productsForStations } from "@/lib/server/station-products";
import type { Business, BusinessProduct, WeeklyOperatingHours } from "@/lib/types";
import bioWaterCover from "@/assets/images/business/bio-water-kasarani.webp";

export class StationPublicationError extends Error {}
export class StationNotFoundError extends Error {}
export class StationUnauthorizedError extends Error {}
export class ListingIncompleteError extends Error {
  constructor(message: string, public readonly missingFields: string[]) {
    super(message);
    this.name = "ListingIncompleteError";
  }
}

export interface ListingCompletenessResult {
  complete: boolean;
  missingFields: string[];
}

export function validateListingCompleteness(
  business: { name: string; slug: string },
  application: {
    businessName: string;
    address: string;
    city: string;
    zones?: string | null;
    deliveryFee: string | number;
    deliveryTimeMinutes: number;
    phone: string;
    email: string;
    description?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
  }
): ListingCompletenessResult {
  const missing: string[] = [];

  if (!business.name?.trim() || business.name.trim().length < 2) missing.push("businessName");
  if (!business.slug?.trim()) missing.push("slug");
  if (!application.address?.trim()) missing.push("address");
  if (!application.city?.trim()) missing.push("city");
  if (!application.zones?.trim()) missing.push("zones");
  if (application.deliveryFee == null || Number.isNaN(Number(application.deliveryFee)) || Number(application.deliveryFee) < 0) {
    missing.push("deliveryFee");
  }
  if (!application.deliveryTimeMinutes || Number(application.deliveryTimeMinutes) <= 0) {
    missing.push("deliveryTimeMinutes");
  }
  if (!application.phone?.trim()) missing.push("phone");
  if (!application.email?.trim()) missing.push("email");
  if (!application.description?.trim() || application.description.trim().length < 10) {
    missing.push("description");
  }
  const lat = application.latitude != null ? Number(application.latitude) : null;
  const lng = application.longitude != null ? Number(application.longitude) : null;
  if (lat == null || Number.isNaN(lat) || lat < -90 || lat > 90) missing.push("latitude");
  if (lng == null || Number.isNaN(lng) || lng < -180 || lng > 180) missing.push("longitude");

  return { complete: missing.length === 0, missingFields: missing };
}

export interface StationPublicationEligibilityResult {
  eligible: boolean;
  reason?: string;
  details: {
    applicationApproved: boolean;
    listingComplete: boolean;
    subscriptionEligible: boolean;
  };
}

/**
 * Authoritative, pure publication gate:
 * 1. The linked application is approved.
 * 2. The business listing is complete.
 * 3. The subscription is either an eligible unexpired trial or an eligible active paid subscription.
 *
 * All eligibility decisions (owner overview, public browse, detail pages, sitemap,
 * and publishBusiness) run through this single function so the rules cannot drift.
 */
export function evaluateStationPublicationEligibility(
  business: { isComplete: boolean } | null | undefined,
  application: { status: string } | null | undefined,
  subscription: SubscriptionRecord | null | undefined,
  now = new Date()
): StationPublicationEligibilityResult {
  if (!business) {
    return {
      eligible: false,
      reason: "Business was not found.",
      details: { applicationApproved: false, listingComplete: false, subscriptionEligible: false },
    };
  }

  const applicationApproved = application?.status === "approved";
  if (!applicationApproved) {
    return {
      eligible: false,
      reason: "The linked application is not approved.",
      details: {
        applicationApproved: false,
        listingComplete: business.isComplete,
        subscriptionEligible: false,
      },
    };
  }

  if (!business.isComplete) {
    return {
      eligible: false,
      reason: "The business listing is incomplete.",
      details: {
        applicationApproved: true,
        listingComplete: false,
        subscriptionEligible: false,
      },
    };
  }

  const subEligibility = evaluateSubscriptionEligibility(subscription, now);
  if (!subEligibility.eligible) {
    return {
      eligible: false,
      reason: subEligibility.reason ?? "The business does not have an eligible subscription or trial.",
      details: {
        applicationApproved: true,
        listingComplete: true,
        subscriptionEligible: false,
      },
    };
  }

  return {
    eligible: true,
    details: {
      applicationApproved: true,
      listingComplete: true,
      subscriptionEligible: true,
    },
  };
}

/**
 * Authoritative single server-side gate checking business existence, application
 * approval, listing completeness and subscription eligibility.
 */
export async function checkStationPublicationEligibility(
  businessId: string,
  now = new Date()
): Promise<StationPublicationEligibilityResult> {
  const { db } = await getDatabase();

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) {
    return evaluateStationPublicationEligibility(null, null, null, now);
  }

  const [application] = await db
    .select()
    .from(businessApplications)
    .where(eq(businessApplications.id, business.applicationId))
    .limit(1);

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.businessId, business.id))
    .limit(1);

  return evaluateStationPublicationEligibility(
    business,
    application,
    subscription as SubscriptionRecord,
    now
  );
}

/**
 * Publishes a business after enforcing the authoritative publication gate.
 * The business will not be published unless all three conditions are satisfied.
 */
export async function publishBusiness(
  businessId: string,
  ownerUserId: string,
  now = new Date()
) {
  const { db } = await getDatabase();

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) throw new StationNotFoundError("Business was not found.");
  if (business.ownerUserId !== ownerUserId) {
    throw new StationUnauthorizedError("You do not have permission to publish this business.");
  }

  const gate = await checkStationPublicationEligibility(businessId, now);
  if (!gate.eligible) {
    throw new StationPublicationError(gate.reason ?? "Station is not eligible for publication.");
  }

  const visibleProducts = (await productsForStations([businessId])).get(businessId) ?? [];
  const storefrontMissing = storefrontMissingFields({
    openingHours: parseWeeklyHours(business.openingHours),
    visibleProductCount: visibleProducts.length,
  });
  if (storefrontMissing.includes("openingHours")) {
    throw new StationPublicationError("Add your opening hours before publishing, so customers know when you take orders.");
  }
  if (storefrontMissing.includes("products")) {
    throw new StationPublicationError("Add at least one product before publishing your station.");
  }

  const [updated] = await db
    .update(businesses)
    .set({
      isPublished: true,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId))
    .returning();

  return updated;
}

export interface ListingUpdates {
  businessName?: string;
  description?: string;
  zones?: string;
  deliveryFee?: number | string;
  deliveryTimeMinutes?: number | string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  /** WeeklyOperatingHours from the setup form; invalid days are dropped. */
  openingHours?: unknown;
  freeDeliveryAbove?: number | string;
}

/**
 * Validates and completes a business listing using genuinely existing schema fields.
 * Validates that all required operational fields are present and valid before setting isComplete = true.
 */
export async function completeBusinessListing(
  businessId: string,
  ownerUserId: string,
  updates?: ListingUpdates
) {
  const { db } = await getDatabase();

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) throw new StationNotFoundError("Business was not found.");
  if (business.ownerUserId !== ownerUserId) {
    throw new StationUnauthorizedError("You do not have permission to modify this business.");
  }

  const [application] = await db
    .select()
    .from(businessApplications)
    .where(eq(businessApplications.id, business.applicationId))
    .limit(1);

  if (!application) throw new StationNotFoundError("Application was not found.");
  if (application.status !== "approved") {
    throw new StationPublicationError("Only approved stations can have their listing completed.");
  }

  let currentApp = application;
  let currentBiz = business;

  if (updates) {
    const appSet: Partial<typeof businessApplications.$inferInsert> = {};
    if (updates.description !== undefined) appSet.description = updates.description.trim();
    if (updates.zones !== undefined) appSet.zones = updates.zones.trim();
    if (updates.deliveryFee !== undefined) {
      const fee = Number(updates.deliveryFee);
      if (Number.isNaN(fee) || fee < 0 || fee > 99_999_999.99) {
        throw new StationPublicationError("Delivery fee is invalid.");
      }
      appSet.deliveryFee = fee.toFixed(2);
    }
    if (updates.deliveryTimeMinutes !== undefined) {
      const minutes = Number(updates.deliveryTimeMinutes);
      if (Number.isNaN(minutes) || minutes <= 0 || minutes > 1_440) {
        throw new StationPublicationError("Delivery time is invalid.");
      }
      appSet.deliveryTimeMinutes = Math.round(minutes);
    }
    if (updates.latitude !== undefined) {
      const lat = updates.latitude !== null && updates.latitude !== "" ? Number(updates.latitude) : null;
      if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
        throw new StationPublicationError("Latitude is invalid.");
      }
      appSet.latitude = lat !== null ? lat.toFixed(6) : null;
    }
    if (updates.longitude !== undefined) {
      const lng = updates.longitude !== null && updates.longitude !== "" ? Number(updates.longitude) : null;
      if (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
        throw new StationPublicationError("Longitude is invalid.");
      }
      appSet.longitude = lng !== null ? lng.toFixed(6) : null;
    }

    if (Object.keys(appSet).length > 0) {
      appSet.updatedAt = new Date();
      const [updatedApp] = await db
        .update(businessApplications)
        .set(appSet)
        .where(eq(businessApplications.id, application.id))
        .returning();
      if (updatedApp) currentApp = updatedApp;
    }

    const businessSet: Partial<typeof businesses.$inferInsert> = {};
    if (updates.openingHours !== undefined) {
      const hours = parseWeeklyHours(updates.openingHours);
      if (!hours) throw new StationPublicationError("Add opening hours for at least one day.");
      businessSet.openingHours = hours;
    }
    if (updates.freeDeliveryAbove !== undefined) {
      const threshold = Number(updates.freeDeliveryAbove);
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1_000_000) {
        throw new StationPublicationError("Free delivery threshold is invalid.");
      }
      businessSet.freeDeliveryAbove = threshold.toFixed(2);
    }
    if (Object.keys(businessSet).length > 0) {
      const [updatedBiz] = await db
        .update(businesses)
        .set({ ...businessSet, updatedAt: new Date() })
        .where(eq(businesses.id, businessId))
        .returning();
      if (updatedBiz) currentBiz = updatedBiz;
    }

    if (updates.businessName !== undefined) {
      const name = updates.businessName.trim();
      if (name.length < 2 || name.length > 160) {
        throw new StationPublicationError("Business name must be between 2 and 160 characters.");
      }
      const [updatedBiz] = await db
        .update(businesses)
        .set({ name, updatedAt: new Date() })
        .where(eq(businesses.id, businessId))
        .returning();
      if (updatedBiz) currentBiz = updatedBiz;
    }
  }

  const completeness = validateListingCompleteness(
    { name: currentBiz.name, slug: currentBiz.slug },
    currentApp
  );

  if (!completeness.complete) {
    throw new ListingIncompleteError(
      `Listing cannot be completed because required fields are missing: ${completeness.missingFields.join(", ")}`,
      completeness.missingFields
    );
  }

  const [completed] = await db
    .update(businesses)
    .set({
      isComplete: true,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId))
    .returning();

  return completed;
}

/**
 * Unpublishes a business.
 */
export async function unpublishBusiness(businessId: string, ownerUserId: string) {
  const { db } = await getDatabase();

  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);

  if (!business) throw new StationNotFoundError("Business was not found.");
  if (business.ownerUserId !== ownerUserId) {
    throw new StationUnauthorizedError("You do not have permission to modify this business.");
  }

  const [updated] = await db
    .update(businesses)
    .set({
      isPublished: false,
      updatedAt: new Date(),
    })
    .where(eq(businesses.id, businessId))
    .returning();

  return updated;
}

/**
 * Authoritative database query for published, eligible stations.
 * Joins businesses, businessApplications, and subscriptions, and strictly verifies:
 * - isPublished is true
 * - isComplete is true
 * - application status is approved
 * - subscription qualifies through evaluateSubscriptionEligibility(now)
 *
 * Throws when the database is unreachable so callers can distinguish an
 * infrastructure failure from a genuinely empty directory.
 */
export async function queryEligiblePublishedDatabaseBusinesses(now: Date) {
  const { db } = await getDatabase();

  const rows = await db
    .select({
      business: businesses,
      application: businessApplications,
      subscription: subscriptions,
    })
    .from(businesses)
    .innerJoin(businessApplications, eq(businesses.applicationId, businessApplications.id))
    .leftJoin(subscriptions, eq(businesses.id, subscriptions.businessId))
    .where(
      and(
        eq(businesses.isPublished, true),
        eq(businesses.isComplete, true),
        isNull(businesses.suspendedAt),
        eq(businessApplications.status, "approved")
      )
    );

  return rows.filter(({ subscription }) => {
    const eligibility = evaluateSubscriptionEligibility(subscription as SubscriptionRecord, now);
    return eligibility.eligible;
  });
}

/**
 * Safe wrapper around the authoritative query for callers that only need
 * results and treat database failures as "no database stations".
 */
export async function getEligiblePublishedDatabaseBusinesses(now = new Date()) {
  try {
    return await queryEligiblePublishedDatabaseBusinesses(now);
  } catch {
    return [];
  }
}

/**
 * Adapts database rows into the Business shape the storefront uses. A new
 * station has no reviews yet, so it carries no rating rather than a made-up one.
 */
export function mapDatabaseBusinessToPublic(
  business: typeof businesses.$inferSelect,
  application: typeof businessApplications.$inferSelect,
  subscription?: typeof subscriptions.$inferSelect | null,
  products: BusinessProduct[] = []
): Business {
  const estates = application.zones
    ? application.zones
        .split(",")
        .map((z) => z.trim())
        .filter(Boolean)
    : [application.city];

  return {
    id: business.id,
    slug: business.slug,
    name: business.name,
    tagline: application.description?.slice(0, 120) || `${business.name} refill station`,
    city: application.city,
    estates,
    rating: 0,
    reviewCount: 0,
    deliveryFee: Number(application.deliveryFee) || 0,
    freeDeliveryAbove: Number(business.freeDeliveryAbove) || 0,
    avgDeliveryMinutes: application.deliveryTimeMinutes || 45,
    verified: application.status === "approved",
    paid: subscription?.status === "active" && Boolean(subscription.paymentConfirmedAt),
    acceptsMpesa: true,
    acceptsCard: false,
    subscription: subscription?.plan ?? application.plan,
    description: application.description || `${business.name} water refill and delivery.`,
    products,
    openingHours: parseWeeklyHours(business.openingHours) ?? undefined,
    accent: "#0057E6",
    cover: bioWaterCover,
    lat: Number(application.latitude) || -1.2921,
    lng: Number(application.longitude) || 36.8219,
  };
}

/**
 * What a complete listing still needs before customers can order: opening
 * hours (orders are refused when hours are unknown) and something to sell.
 */
export function storefrontMissingFields(station: {
  openingHours?: WeeklyOperatingHours | null;
  visibleProductCount: number;
}): string[] {
  const missing: string[] = [];
  const hours = station.openingHours;
  if (!hours || !Object.values(hours).some((day) => day !== null && day !== undefined)) missing.push("openingHours");
  if (station.visibleProductCount < 1) missing.push("products");
  return missing;
}
