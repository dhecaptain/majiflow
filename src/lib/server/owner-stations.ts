import { desc, eq } from "drizzle-orm";
import { getDatabase } from "@/lib/server/db";
import { businesses, businessApplications, subscriptions } from "@/lib/server/db/schema";
import type { SubscriptionRecord } from "@/lib/server/subscriptions";
import { parseWeeklyHours } from "@/lib/business-hours";
import { productsForStations } from "@/lib/server/station-products";
import type { WeeklyOperatingHours } from "@/lib/types";
import {
  evaluateStationPublicationEligibility,
  storefrontMissingFields,
  validateListingCompleteness,
  type StationPublicationEligibilityResult,
} from "@/lib/server/station-publication";

export interface OwnerStationOverview {
  business: {
    id: string;
    slug: string;
    name: string;
    isComplete: boolean;
    isPublished: boolean;
    openingHours: WeeklyOperatingHours | null;
    freeDeliveryAbove: number;
    productCount: number;
    createdAt: Date;
    updatedAt: Date;
  };
  application: {
    id: string;
    status: string;
    businessName: string;
    ownerName: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    zones: string | null;
    deliveryFee: string;
    deliveryTimeMinutes: number;
    plan: string;
    description: string | null;
    latitude: string | null;
    longitude: string | null;
  };
  subscription: {
    plan: string;
    status: string;
    trialStartedAt: Date | null;
    trialEndsAt: Date | null;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
  } | null;
  missingFields: string[];
  /** Still needed before customers can order: "openingHours", "products". */
  storefrontMissing: string[];
  eligibility: StationPublicationEligibilityResult["details"];
  eligible: boolean;
  ineligibilityReason: string | null;
}

/**
 * Owner-authorized overview of every station linked to approved applications.
 * Publication eligibility always comes from the shared authoritative gate, so the
 * dashboard can never claim a station is publishable when the gate would refuse.
 */
export async function listOwnerStations(
  ownerUserId: string,
  now = new Date()
): Promise<OwnerStationOverview[]> {
  const { db } = await getDatabase();

  const rows = await db
    .select({
      business: businesses,
      application: businessApplications,
      subscription: subscriptions,
    })
    .from(businesses)
    .innerJoin(businessApplications, eq(businesses.applicationId, businessApplications.id))
    .leftJoin(subscriptions, eq(subscriptions.businessId, businesses.id))
    .where(eq(businesses.ownerUserId, ownerUserId))
    .orderBy(desc(businesses.createdAt));

  const products = await productsForStations(rows.map((row) => row.business.id));

  return rows.map(({ business, application, subscription }) => {
    const openingHours = parseWeeklyHours(business.openingHours);
    const productCount = products.get(business.id)?.length ?? 0;
    const completeness = validateListingCompleteness(
      { name: business.name, slug: business.slug },
      application
    );
    const gate = evaluateStationPublicationEligibility(
      business,
      application,
      subscription as SubscriptionRecord | null,
      now
    );

    return {
      business: {
        id: business.id,
        slug: business.slug,
        name: business.name,
        isComplete: business.isComplete,
        isPublished: business.isPublished,
        openingHours,
        freeDeliveryAbove: Number(business.freeDeliveryAbove) || 0,
        productCount,
        createdAt: business.createdAt,
        updatedAt: business.updatedAt,
      },
      application: {
        id: application.id,
        status: application.status,
        businessName: application.businessName,
        ownerName: application.ownerName,
        phone: application.phone,
        email: application.email,
        address: application.address,
        city: application.city,
        zones: application.zones,
        deliveryFee: application.deliveryFee,
        deliveryTimeMinutes: application.deliveryTimeMinutes,
        plan: application.plan,
        description: application.description,
        latitude: application.latitude,
        longitude: application.longitude,
      },
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            trialStartedAt: subscription.trialStartedAt,
            trialEndsAt: subscription.trialEndsAt,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
          }
        : null,
      missingFields: completeness.missingFields,
      storefrontMissing: storefrontMissingFields({ openingHours, visibleProductCount: productCount }),
      eligibility: gate.details,
      eligible: gate.eligible,
      ineligibilityReason: gate.eligible ? null : gate.reason ?? "Station is not eligible for publication.",
    };
  });
}
