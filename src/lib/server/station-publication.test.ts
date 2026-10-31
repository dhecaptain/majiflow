import { beforeEach, describe, expect, it, vi } from "vitest";

const dbState = vi.hoisted(() => ({
  businesses: [] as Record<string, unknown>[],
  applications: [] as Record<string, unknown>[],
  subscriptions: [] as Record<string, unknown>[],
  failDatabase: false,
  visibleProducts: 1,
}));

vi.mock("@/lib/server/station-products", () => ({
  productsForStations: async (ids: string[]) =>
    new Map(ids.map((id) => [id, Array.from({ length: dbState.visibleProducts }, (_, i) => ({ id: `p${i}` }))])),
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (col: unknown, val: unknown) => ({ col, val }),
}));

vi.mock("@/lib/server/db/schema", () => ({
  businesses: {
    id: "b_id",
    applicationId: "b_appId",
    slug: "b_slug",
    isPublished: "b_isPublished",
    isComplete: "b_isComplete",
  },
  businessApplications: {
    id: "a_id",
    status: "a_status",
  },
  subscriptions: {
    id: "s_id",
    businessId: "s_bizId",
  },
}));

vi.mock("@/lib/server/db", () => ({
  getDatabase: async () => {
    if (dbState.failDatabase) throw new Error("Database unavailable.");
    return {
      db: {
      select: () => ({
        from: () => {
          let innerJoined = false;

          const queryBuilder = {
            innerJoin: () => {
              innerJoined = true;
              return queryBuilder;
            },
            leftJoin: () => queryBuilder,
            where: (filter: unknown) => ({
              limit: async () => {
                // If it's a join query (like getPublicStationBySlug)
                if (innerJoined) {
                  const filterObj = filter as { col: unknown; val: unknown };
                  const targetSlug = filterObj?.val;
                  const biz = dbState.businesses.find((b) => b.slug === targetSlug);
                  if (!biz) return [];
                  const app = dbState.applications.find((a) => a.id === biz.applicationId);
                  const sub = dbState.subscriptions.find((s) => s.businessId === biz.id);
                  return [{ business: biz, application: app, subscription: sub }];
                }

                // If single table query
                const f = filter as { col: unknown; val: unknown };
                if (f?.col === "b_id") {
                  const found = dbState.businesses.find((b) => b.id === f.val);
                  return found ? [found] : [];
                }
                if (f?.col === "a_id") {
                  const found = dbState.applications.find((a) => a.id === f.val);
                  return found ? [found] : [];
                }
                if (f?.col === "s_bizId") {
                  const found = dbState.subscriptions.find((s) => s.businessId === f.val);
                  return found ? [found] : [];
                }
                return [];
              },
              then: async (resolve: (val: unknown) => unknown) => {
                // For joined list queries
                const results = dbState.businesses.map((biz) => {
                  const app = dbState.applications.find((a) => a.id === biz.applicationId);
                  const sub = dbState.subscriptions.find((s) => s.businessId === biz.id);
                  return { business: biz, application: app, subscription: sub };
                }).filter((r) => r.business.isPublished && r.business.isComplete && r.application?.status === "approved");
                return resolve(results);
              },
            }),
          };
          return queryBuilder;
        },
      }),
      update: () => ({
        set: (vals: Record<string, unknown>) => ({
          where: (filter: { val: string }) => ({
            returning: async () => {
              const b = dbState.businesses.find((biz) => biz.id === filter.val);
              if (b) {
                Object.assign(b, vals);
                return [b];
              }
              return [];
            },
          }),
        }),
      }),
      },
    };
  },
}));

import {
  checkStationPublicationEligibility,
  completeBusinessListing,
  getEligiblePublishedDatabaseBusinesses,
  ListingIncompleteError,
  publishBusiness,
  StationPublicationError,
  StationUnauthorizedError,
  validateListingCompleteness,
} from "./station-publication";

describe("Station Publication Gate and Discovery", () => {
  const baseNow = new Date("2026-10-16T12:00:00Z");

  beforeEach(() => {
    dbState.businesses = [
      {
        id: "biz-1",
        applicationId: "app-1",
        ownerUserId: "owner-1",
        name: "Lake Aqua Clean",
        slug: "lake-aqua-clean",
        isComplete: true,
        isPublished: false,
        openingHours: { monday: { open: "07:00", close: "19:00" } },
      },
    ];
    dbState.visibleProducts = 1;
    dbState.applications = [
      {
        id: "app-1",
        status: "approved",
        businessName: "Lake Aqua Clean",
        city: "Kisumu",
        deliveryFee: "100.00",
        deliveryTimeMinutes: 30,
        plan: "growth",
        zones: "Milimani, Tom Mboya",
      },
    ];
    dbState.subscriptions = [
      {
        id: "sub-1",
        businessId: "biz-1",
        plan: "growth",
        status: "trialing",
        trialStartedAt: new Date("2026-10-10T00:00:00Z"),
        trialEndsAt: new Date("2026-10-24T00:00:00Z"),
        currentPeriodStart: null,
        currentPeriodEnd: null,
      },
    ];
  });

  describe("checkStationPublicationEligibility", () => {
    it("qualifies when application is approved, listing is complete, and trial is active and unexpired", async () => {
      const result = await checkStationPublicationEligibility("biz-1", baseNow);
      expect(result.eligible).toBe(true);
      expect(result.details.applicationApproved).toBe(true);
      expect(result.details.listingComplete).toBe(true);
      expect(result.details.subscriptionEligible).toBe(true);
    });

    it("rejects when the business listing is incomplete", async () => {
      dbState.businesses[0].isComplete = false;
      const result = await checkStationPublicationEligibility("biz-1", baseNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("listing is incomplete");
      expect(result.details.listingComplete).toBe(false);
    });

    it("rejects when the linked application is not approved", async () => {
      dbState.applications[0].status = "under_review";
      const result = await checkStationPublicationEligibility("biz-1", baseNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("linked application is not approved");
      expect(result.details.applicationApproved).toBe(false);
    });

    it("rejects when trial has expired", async () => {
      dbState.subscriptions[0].trialEndsAt = new Date("2026-10-15T00:00:00Z");
      const result = await checkStationPublicationEligibility("biz-1", baseNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("trial period has expired");
      expect(result.details.subscriptionEligible).toBe(false);
    });

    it("rejects when subscription is cancelled", async () => {
      dbState.subscriptions[0].status = "cancelled";
      const result = await checkStationPublicationEligibility("biz-1", baseNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("cancelled");
    });

    it("rejects when subscription is expired", async () => {
      dbState.subscriptions[0].status = "expired";
      const result = await checkStationPublicationEligibility("biz-1", baseNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("expired");
    });

    it("rejects active paid subscription without trusted payment confirmation", async () => {
      dbState.subscriptions[0] = {
        id: "sub-1",
        businessId: "biz-1",
        plan: "growth",
        status: "active",
        currentPeriodStart: new Date("2026-10-01T00:00:00Z"),
        currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
        paymentConfirmedAt: null,
      };
      const result = await checkStationPublicationEligibility("biz-1", baseNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("no verified payment confirmation");
    });

    it("qualifies when active paid subscription has trusted payment confirmation", async () => {
      dbState.subscriptions[0] = {
        id: "sub-1",
        businessId: "biz-1",
        plan: "growth",
        status: "active",
        currentPeriodStart: new Date("2026-10-01T00:00:00Z"),
        currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
        paymentConfirmedAt: new Date("2026-10-01T00:05:00Z"),
        paymentReference: "CONFIRMED-PAY-99",
      };
      const result = await checkStationPublicationEligibility("biz-1", baseNow);
      expect(result.eligible).toBe(true);
      expect(result.details.subscriptionEligible).toBe(true);
    });
  });

  describe("validateListingCompleteness", () => {
    const completeBusiness = { name: "Lake Aqua Clean", slug: "lake-aqua-clean" };
    const completeApplication = {
      businessName: "Lake Aqua Clean",
      address: "Milimani Road",
      city: "Kisumu",
      zones: "Milimani, Tom Mboya",
      deliveryFee: "100.00",
      deliveryTimeMinutes: 30,
      phone: "+254700000000",
      email: "owner@example.com",
      description: "Family run refill station serving the lakefront estates.",
      latitude: "-0.091700",
      longitude: "34.768000",
    };

    it("marks a fully valid listing complete with no missing fields", () => {
      expect(validateListingCompleteness(completeBusiness, completeApplication)).toEqual({
        complete: true,
        missingFields: [],
      });
    });

    it("reports every genuinely missing or invalid required field", () => {
      const result = validateListingCompleteness(
        { name: "A", slug: "  " },
        {
          ...completeApplication,
          address: "",
          city: " ",
          zones: "   ",
          deliveryFee: "-5",
          deliveryTimeMinutes: 0,
          phone: "",
          email: "",
          description: "short",
          latitude: "91",
          longitude: null,
        }
      );

      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual(
        expect.arrayContaining([
          "businessName",
          "slug",
          "address",
          "city",
          "zones",
          "deliveryFee",
          "deliveryTimeMinutes",
          "phone",
          "email",
          "description",
          "latitude",
          "longitude",
        ])
      );
    });

    it("never treats non-finite fees or out-of-range coordinates as complete", () => {
      const result = validateListingCompleteness(completeBusiness, {
        ...completeApplication,
        deliveryFee: "not-a-number",
        latitude: "90.000001",
        longitude: "-180.5",
      });

      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual(
        expect.arrayContaining(["deliveryFee", "latitude", "longitude"])
      );
    });
  });

  describe("completeBusinessListing", () => {
    const completeApplication = {
      id: "app-1",
      status: "approved",
      businessName: "Lake Aqua Clean",
      address: "Milimani Road",
      city: "Kisumu",
      zones: "Milimani, Tom Mboya",
      deliveryFee: "100.00",
      deliveryTimeMinutes: 30,
      plan: "growth",
      phone: "+254700000000",
      email: "owner@example.com",
      description: "Family run refill station serving the lakefront estates.",
      latitude: "-0.091700",
      longitude: "34.768000",
    };

    it("completes a genuinely valid listing after server-side validation", async () => {
      dbState.businesses[0].isComplete = false;
      dbState.applications[0] = completeApplication;

      const updated = await completeBusinessListing("biz-1", "owner-1");
      expect(updated.isComplete).toBe(true);
    });

    it("refuses to complete a listing that is missing required fields", async () => {
      dbState.businesses[0].isComplete = false;
      dbState.applications[0] = {
        ...completeApplication,
        zones: "  ",
        description: "short",
        latitude: null,
        longitude: null,
      };

      await expect(completeBusinessListing("biz-1", "owner-1")).rejects.toBeInstanceOf(
        ListingIncompleteError
      );
      expect(dbState.businesses[0].isComplete).toBe(false);
    });

    it("rejects invalid fee, time, coordinate and name updates without completing the listing", async () => {
      dbState.businesses[0].isComplete = false;
      dbState.applications[0] = completeApplication;

      await expect(
        completeBusinessListing("biz-1", "owner-1", { deliveryFee: -1 })
      ).rejects.toBeInstanceOf(StationPublicationError);
      await expect(
        completeBusinessListing("biz-1", "owner-1", { deliveryFee: "Infinity" })
      ).rejects.toBeInstanceOf(StationPublicationError);
      await expect(
        completeBusinessListing("biz-1", "owner-1", { deliveryTimeMinutes: 0 })
      ).rejects.toBeInstanceOf(StationPublicationError);
      await expect(
        completeBusinessListing("biz-1", "owner-1", { deliveryTimeMinutes: 1_441 })
      ).rejects.toBeInstanceOf(StationPublicationError);
      await expect(
        completeBusinessListing("biz-1", "owner-1", { latitude: 90.0001 })
      ).rejects.toBeInstanceOf(StationPublicationError);
      await expect(
        completeBusinessListing("biz-1", "owner-1", { longitude: -180.5 })
      ).rejects.toBeInstanceOf(StationPublicationError);
      await expect(
        completeBusinessListing("biz-1", "owner-1", { businessName: "x".repeat(161) })
      ).rejects.toBeInstanceOf(StationPublicationError);

      expect(dbState.businesses[0].isComplete).toBe(false);
    });

    it("rejects non-owners before validating the listing", async () => {
      await expect(completeBusinessListing("biz-1", "intruder")).rejects.toBeInstanceOf(
        StationUnauthorizedError
      );
      expect(dbState.businesses[0].isComplete).toBe(true);
    });
  });

  describe("publishBusiness", () => {
    it("publishes an eligible business", async () => {
      const updated = await publishBusiness("biz-1", "owner-1", baseNow);
      expect(updated.isPublished).toBe(true);
    });

    it("refuses to publish a station with nothing to sell", async () => {
      dbState.visibleProducts = 0;
      await expect(publishBusiness("biz-1", "owner-1", baseNow)).rejects.toThrow(/at least one product/);
      expect(dbState.businesses[0].isPublished).toBe(false);
    });

    it("refuses to publish a station without opening hours", async () => {
      dbState.businesses[0].openingHours = null;
      await expect(publishBusiness("biz-1", "owner-1", baseNow)).rejects.toThrow(/opening hours/);
      expect(dbState.businesses[0].isPublished).toBe(false);
    });

    it("prevents publishing when ineligible", async () => {
      dbState.businesses[0].isComplete = false;
      await expect(publishBusiness("biz-1", "owner-1", baseNow)).rejects.toBeInstanceOf(
        StationPublicationError
      );
      expect(dbState.businesses[0].isPublished).toBe(false);
    });

    it("rejects unauthorized user from publishing", async () => {
      await expect(publishBusiness("biz-1", "intruder", baseNow)).rejects.toBeInstanceOf(
        StationUnauthorizedError
      );
      expect(dbState.businesses[0].isPublished).toBe(false);
    });
  });

  describe("Public browse and query integration", () => {
    it("excludes ineligible database-backed stations from public query", async () => {
      dbState.businesses[0].isPublished = true;
      dbState.businesses[0].isComplete = true;
      // Expired trial
      dbState.subscriptions[0].trialEndsAt = new Date("2026-10-15T00:00:00Z");

      const publicBusinesses = await getEligiblePublishedDatabaseBusinesses(baseNow);
      expect(publicBusinesses).toHaveLength(0);
    });

    it("excludes incomplete stations even if marked isPublished = true", async () => {
      dbState.businesses[0].isPublished = true;
      dbState.businesses[0].isComplete = false;

      const publicBusinesses = await getEligiblePublishedDatabaseBusinesses(baseNow);
      expect(publicBusinesses).toHaveLength(0);
    });
  });
});
