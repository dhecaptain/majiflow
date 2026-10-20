import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  evaluateSubscriptionEligibility,
  recordConfirmedPaidSubscription,
  startFreeTrial,
  SubscriptionConflictError,
  SubscriptionError,
  SubscriptionUnauthorizedError,
  type SubscriptionRecord,
} from "./subscriptions";

const dbState = vi.hoisted(() => ({
  businesses: [] as Record<string, unknown>[],
  applications: [] as Record<string, unknown>[],
  subscriptions: [] as Record<string, unknown>[],
  forceInsertConflict: false,
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));

vi.mock("@/lib/server/db/schema", () => ({
  businesses: { id: "biz_id", ownerUserId: "ownerUserId", applicationId: "applicationId" },
  businessApplications: { id: "app_id", status: "status", plan: "plan" },
  subscriptions: { id: "sub_id", businessId: "businessId" },
}));

vi.mock("@/lib/server/db", () => ({
  getDatabase: async () => ({
    db: {
      select: () => ({
        from: () => ({
          where: (filter: { column: string; value: unknown }) => ({
            limit: async () => {
              if (filter.column === "biz_id") {
                const found = dbState.businesses.find((b) => b.id === filter.value);
                return found ? [found] : [];
              }
              if (filter.column === "app_id") {
                const found = dbState.applications.find((a) => a.id === filter.value);
                return found ? [found] : [];
              }
              if (filter.column === "businessId") {
                const found = dbState.subscriptions.find((s) => s.businessId === filter.value);
                return found ? [found] : [];
              }
              return [];
            },
          }),
        }),
      }),
      insert: () => ({
        values: (val: Record<string, unknown>) => {
          const runInsert = async () => {
            const conflict =
              dbState.forceInsertConflict ||
              dbState.subscriptions.find((s) => s.businessId === val.businessId);
            if (conflict) {
              return [];
            }
            const row = { id: `sub-${Date.now()}`, ...val };
            dbState.subscriptions.push(row);
            return [row];
          };
          return {
            onConflictDoNothing: () => ({
              returning: runInsert,
            }),
            returning: runInsert,
          };
        },
      }),
      update: () => ({
        set: (vals: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              if (dbState.subscriptions.length > 0) {
                dbState.subscriptions[0] = { ...dbState.subscriptions[0], ...vals };
                return [dbState.subscriptions[0]];
              }
              return [];
            },
          }),
        }),
      }),
    },
  }),
}));

describe("Subscription Eligibility Service", () => {
  const baseNow = new Date("2026-10-16T12:00:00Z");

  describe("evaluateSubscriptionEligibility", () => {
    it("rejects when no subscription record exists", () => {
      const result = evaluateSubscriptionEligibility(null, baseNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("No subscription record");
    });

    it("rejects cancelled subscriptions", () => {
      const sub: SubscriptionRecord = {
        businessId: "biz-1",
        plan: "growth",
        status: "cancelled",
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      };
      const result = evaluateSubscriptionEligibility(sub, baseNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("cancelled");
    });

    it("rejects expired subscriptions", () => {
      const sub: SubscriptionRecord = {
        businessId: "biz-1",
        plan: "starter",
        status: "expired",
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
      };
      const result = evaluateSubscriptionEligibility(sub, baseNow);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("expired");
    });

    describe("trialing status", () => {
      it("qualifies when within a valid unexpired free trial window", () => {
        const sub: SubscriptionRecord = {
          businessId: "biz-1",
          plan: "growth",
          status: "trialing",
          trialStartedAt: new Date("2026-10-10T00:00:00Z"),
          trialEndsAt: new Date("2026-10-24T00:00:00Z"),
          currentPeriodStart: null,
          currentPeriodEnd: null,
        };
        const result = evaluateSubscriptionEligibility(sub, baseNow);
        expect(result.eligible).toBe(true);
        expect(result.type).toBe("trial");
      });

      it("rejects when trial has expired", () => {
        const sub: SubscriptionRecord = {
          businessId: "biz-1",
          plan: "growth",
          status: "trialing",
          trialStartedAt: new Date("2026-10-01T00:00:00Z"),
          trialEndsAt: new Date("2026-10-15T00:00:00Z"),
          currentPeriodStart: null,
          currentPeriodEnd: null,
        };
        const result = evaluateSubscriptionEligibility(sub, baseNow);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain("expired");
      });

      it("rejects when trial has not yet started", () => {
        const sub: SubscriptionRecord = {
          businessId: "biz-1",
          plan: "growth",
          status: "trialing",
          trialStartedAt: new Date("2026-10-18T00:00:00Z"),
          trialEndsAt: new Date("2026-11-01T00:00:00Z"),
          currentPeriodStart: null,
          currentPeriodEnd: null,
        };
        const result = evaluateSubscriptionEligibility(sub, baseNow);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain("not started yet");
      });

      it("rejects when trial timestamps are missing or invalid", () => {
        const missingDates: SubscriptionRecord = {
          businessId: "biz-1",
          plan: "pro",
          status: "trialing",
          trialStartedAt: null,
          trialEndsAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        };
        expect(evaluateSubscriptionEligibility(missingDates, baseNow).eligible).toBe(false);

        const invalidDates: SubscriptionRecord = {
          businessId: "biz-1",
          plan: "pro",
          status: "trialing",
          trialStartedAt: new Date("2026-10-25T00:00:00Z"),
          trialEndsAt: new Date("2026-10-10T00:00:00Z"),
          currentPeriodStart: null,
          currentPeriodEnd: null,
        };
        expect(evaluateSubscriptionEligibility(invalidDates, baseNow).eligible).toBe(false);
      });
    });

    describe("active paid status", () => {
      it("rejects active paid subscription without payment confirmation", () => {
        const sub: SubscriptionRecord = {
          businessId: "biz-1",
          plan: "pro",
          status: "active",
          trialStartedAt: null,
          trialEndsAt: null,
          currentPeriodStart: new Date("2026-10-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
          paymentConfirmedAt: null,
        };
        const result = evaluateSubscriptionEligibility(sub, baseNow);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain("no verified payment confirmation");
      });

      it("qualifies when active with valid period AND confirmed payment", () => {
        const sub: SubscriptionRecord = {
          businessId: "biz-1",
          plan: "pro",
          status: "active",
          trialStartedAt: null,
          trialEndsAt: null,
          currentPeriodStart: new Date("2026-10-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-11-01T00:00:00Z"),
          paymentConfirmedAt: new Date("2026-10-01T00:05:00Z"),
          paymentReference: "PAY-123456",
        };
        const result = evaluateSubscriptionEligibility(sub, baseNow);
        expect(result.eligible).toBe(true);
        expect(result.type).toBe("paid");
      });

      it("rejects active subscription when period has expired", () => {
        const sub: SubscriptionRecord = {
          businessId: "biz-1",
          plan: "pro",
          status: "active",
          trialStartedAt: null,
          trialEndsAt: null,
          currentPeriodStart: new Date("2026-09-01T00:00:00Z"),
          currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
          paymentConfirmedAt: new Date("2026-09-01T00:05:00Z"),
          paymentReference: "PAY-123456",
        };
        const result = evaluateSubscriptionEligibility(sub, baseNow);
        expect(result.eligible).toBe(false);
        expect(result.reason).toContain("expired");
      });
    });
  });

  describe("startFreeTrial server action", () => {
    beforeEach(() => {
      dbState.businesses = [
        { id: "biz-1", ownerUserId: "owner-1", applicationId: "app-1" },
      ];
      dbState.applications = [
        { id: "app-1", status: "approved", plan: "growth" },
      ];
      dbState.subscriptions = [];
    });

    it("starts a 14-day trial for an approved business", async () => {
      const created = await startFreeTrial("biz-1", "owner-1", "growth", baseNow);
      expect(created.status).toBe("trialing");
      expect(created.plan).toBe("growth");
      expect(new Date(created.trialStartedAt!).toISOString()).toBe(baseNow.toISOString());

      const expectedEnd = new Date(baseNow.getTime() + 14 * 24 * 60 * 60 * 1000);
      expect(new Date(created.trialEndsAt!).toISOString()).toBe(expectedEnd.toISOString());
    });

    it("prevents starting a trial if the application is not approved", async () => {
      dbState.applications = [{ id: "app-1", status: "under_review", plan: "growth" }];
      await expect(startFreeTrial("biz-1", "owner-1", "growth", baseNow)).rejects.toBeInstanceOf(
        SubscriptionError
      );
    });

    it("prevents non-owners from starting a trial", async () => {
      await expect(startFreeTrial("biz-1", "stranger", "growth", baseNow)).rejects.toBeInstanceOf(
        SubscriptionUnauthorizedError
      );
    });

    it("prevents starting a duplicate trial if subscription already exists", async () => {
      dbState.subscriptions = [{ businessId: "biz-1", status: "trialing" }];
      await expect(startFreeTrial("biz-1", "owner-1", "growth", baseNow)).rejects.toThrow(
        "already exists"
      );
    });

    it("rejects an unsupported plan", async () => {
      await expect(
        startFreeTrial("biz-1", "owner-1", "enterprise" as never, baseNow)
      ).rejects.toThrow("Plan is invalid");
      expect(dbState.subscriptions).toHaveLength(0);
    });

    it("creates exactly one subscription when two trial starts race", async () => {
      const results = await Promise.allSettled([
        startFreeTrial("biz-1", "owner-1", "growth", baseNow),
        startFreeTrial("biz-1", "owner-1", "growth", baseNow),
      ]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.filter((result) => result.status === "rejected");
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        SubscriptionConflictError
      );
      expect(dbState.subscriptions).toHaveLength(1);
    });

    it("returns a controlled conflict when the database reports an insert conflict", async () => {
      dbState.forceInsertConflict = true;
      try {
        await expect(
          startFreeTrial("biz-1", "owner-1", "growth", baseNow)
        ).rejects.toBeInstanceOf(SubscriptionConflictError);
      } finally {
        dbState.forceInsertConflict = false;
      }
    });
  });

  describe("recordConfirmedPaidSubscription", () => {
    beforeEach(() => {
      dbState.businesses = [{ id: "biz-1", ownerUserId: "owner-1", applicationId: "app-1" }];
      dbState.subscriptions = [];
    });

    it("records trusted server-side payment confirmation", async () => {
      const result = await recordConfirmedPaidSubscription("biz-1", {
        plan: "pro",
        periodStart: new Date("2026-10-01T00:00:00Z"),
        periodEnd: new Date("2026-11-01T00:00:00Z"),
        paymentReference: "REC-987654",
        confirmedAt: baseNow,
      });

      expect(result.status).toBe("active");
      expect(result.paymentReference).toBe("REC-987654");
      expect(result.paymentConfirmedAt).toEqual(baseNow);
    });

    it("rejects payment activation without a payment reference", async () => {
      await expect(
        recordConfirmedPaidSubscription("biz-1", {
          plan: "pro",
          periodStart: new Date("2026-10-01T00:00:00Z"),
          periodEnd: new Date("2026-11-01T00:00:00Z"),
          paymentReference: "  ",
        })
      ).rejects.toThrow("trusted payment reference is required");
    });

    it("rejects paid periods where the start is not strictly before the end", async () => {
      await expect(
        recordConfirmedPaidSubscription("biz-1", {
          plan: "pro",
          periodStart: new Date("2026-11-01T00:00:00Z"),
          periodEnd: new Date("2026-10-01T00:00:00Z"),
          paymentReference: "REC-REVERSED",
        })
      ).rejects.toThrow("strictly before");

      await expect(
        recordConfirmedPaidSubscription("biz-1", {
          plan: "pro",
          periodStart: new Date("2026-10-01T00:00:00Z"),
          periodEnd: new Date("2026-10-01T00:00:00Z"),
          paymentReference: "REC-ZERO",
        })
      ).rejects.toThrow("strictly before");
    });

    it("rejects invalid paid period timestamps", async () => {
      await expect(
        recordConfirmedPaidSubscription("biz-1", {
          plan: "pro",
          periodStart: new Date("not-a-date"),
          periodEnd: new Date("2026-10-01T00:00:00Z"),
          paymentReference: "REC-INVALID",
        })
      ).rejects.toThrow("timestamps are invalid");
      expect(dbState.subscriptions).toHaveLength(0);
    });
  });
});
