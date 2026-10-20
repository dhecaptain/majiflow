import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  current: {
    id: "11111111-1111-4111-8111-111111111111",
    ownerUserId: "owner-1",
    businessName: "Aqua Kasarani",
    status: "submitted" as string,
    rejectionReason: null as string | null,
  },
  businesses: [] as Record<string, unknown>[],
  updated: null as Record<string, unknown> | null,
  forceConflict: false,
  failBusinessInsert: false,
}));

vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => conditions,
  desc: (column: unknown) => column,
  eq: (column: unknown, value: unknown) => ({ column, value }),
}));
vi.mock("@/lib/server/db/schema", () => ({
  businessApplications: {
    id: "app_id",
    status: "status",
    submittedAt: "submittedAt",
    createdAt: "createdAt",
  },
  businesses: {
    id: "biz_id",
    applicationId: "applicationId",
    slug: "slug",
  },
}));
vi.mock("@/lib/server/db", () => {
  function createExecutor() {
    return {
      select: () => ({
        from: (table: unknown) => ({
          where: (filter: { column?: unknown; value?: unknown }) => ({
            limit: async () => {
              if (table && typeof table === "object" && "applicationId" in table) {
                if (filter?.column === "applicationId") {
                  const found = state.businesses.find((business) => business.applicationId === filter.value);
                  return found ? [found] : [];
                }
                return [];
              }
              return state.current ? [state.current] : [];
            },
          }),
        }),
      }),
      insert: () => ({
        values: (values: Record<string, unknown>) => ({
          onConflictDoNothing: () => ({
            returning: async () => {
              if (state.failBusinessInsert) {
                throw new Error("connection to database terminated");
              }
              const duplicateApplication = state.businesses.some(
                (business) => business.applicationId === values.applicationId
              );
              const duplicateSlug = state.businesses.some((business) => business.slug === values.slug);
              if (duplicateApplication || duplicateSlug) return [];
              const row = { id: `biz-${state.businesses.length + 1}`, ...values };
              state.businesses.push(row);
              return [row];
            },
          }),
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: (conditions: unknown) => ({
            returning: async () => {
              if (state.forceConflict) return [];
              const filters = Array.isArray(conditions) ? conditions : [conditions];
              const expectedStatus = filters.find(
                (condition): condition is { column: unknown; value: unknown } =>
                  typeof condition === "object" &&
                  condition !== null &&
                  (condition as { column?: unknown }).column === "status"
              );
              if (expectedStatus && expectedStatus.value !== state.current.status) return [];
              state.current = { ...state.current, ...values };
              state.updated = state.current;
              return [state.current];
            },
          }),
        }),
      }),
    };
  }

  // Transactions run one at a time so commit/rollback state is deterministic;
  // each failed transaction restores the snapshot captured when it started.
  let queue: Promise<unknown> = Promise.resolve();

  return {
    getDatabase: async () => ({
      db: {
        ...createExecutor(),
        transaction: (callback: (tx: ReturnType<typeof createExecutor>) => Promise<unknown>) => {
          const run = queue.then(async () => {
            const snapshot = { current: state.current, businesses: [...state.businesses] };
            try {
              return await callback(createExecutor());
            } catch (error) {
              state.current = snapshot.current;
              state.businesses = snapshot.businesses;
              throw error;
            }
          });
          queue = run.catch(() => undefined);
          return run;
        },
      },
    }),
  };
});

import { getDatabase } from "@/lib/server/db";
import {
  BusinessApplicationConflictError,
  BusinessApplicationNotFoundError,
  BusinessApplicationSelfReviewError,
  BusinessApplicationTransitionError,
  ensureBusinessForApplication,
  updateBusinessApplicationStatus,
  type BusinessRecordExecutor,
} from "./business-applications";

const REVIEWER_ID = "ops-1";

describe("business application review transitions", () => {
  beforeEach(() => {
    state.current = {
      id: "11111111-1111-4111-8111-111111111111",
      ownerUserId: "owner-1",
      businessName: "Aqua Kasarani",
      status: "submitted",
      rejectionReason: null,
    };
    state.businesses = [];
    state.updated = null;
    state.forceConflict = false;
    state.failBusinessInsert = false;
  });

  it("persists submitted to under_review", async () => {
    const result = await updateBusinessApplicationStatus(state.current.id, "under_review", undefined, REVIEWER_ID);
    expect(result.status).toBe("under_review");
    expect(state.updated?.status).toBe("under_review");
  });

  it("rejects invalid transitions", async () => {
    await expect(updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID)).rejects.toBeInstanceOf(BusinessApplicationTransitionError);
  });

  it("requires a non-blank rejection reason", async () => {
    await expect(updateBusinessApplicationStatus(state.current.id, "rejected", "  ", REVIEWER_ID)).rejects.toThrow(
      "A rejection reason is required."
    );
    expect(state.updated).toBeNull();
  });

  it("rejects a reason supplied for under_review or approved", async () => {
    await expect(updateBusinessApplicationStatus(state.current.id, "under_review", "Needs review", REVIEWER_ID)).rejects.toThrow(
      "only allowed when rejecting"
    );
    state.current.status = "under_review";
    await expect(updateBusinessApplicationStatus(state.current.id, "approved", "Still reviewing", REVIEWER_ID)).rejects.toThrow(
      "only allowed when rejecting"
    );
    expect(state.updated).toBeNull();
  });

  it("persists valid terminal transitions and trims the rejection reason", async () => {
    state.current.status = "under_review";
    const result = await updateBusinessApplicationStatus(state.current.id, "rejected", "  Missing documents  ", REVIEWER_ID);
    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toBe("Missing documents");
  });

  it("rejects an overlong rejection reason before persistence", async () => {
    await expect(updateBusinessApplicationStatus(state.current.id, "rejected", "x".repeat(2001), REVIEWER_ID)).rejects.toThrow(
      "2000 characters or fewer"
    );
    expect(state.updated).toBeNull();
  });

  it("rejects an unexpected persisted status", async () => {
    state.current.status = "archived";
    await expect(updateBusinessApplicationStatus(state.current.id, "under_review", undefined, REVIEWER_ID)).rejects.toThrow(
      "invalid current status"
    );
    expect(state.updated).toBeNull();
  });

  it("reports a conflict when the conditional update matches no row", async () => {
    state.forceConflict = true;
    await expect(updateBusinessApplicationStatus(state.current.id, "under_review", undefined, REVIEWER_ID)).rejects.toBeInstanceOf(
      BusinessApplicationConflictError
    );
    expect(state.updated).toBeNull();
  });

  it("rejects invalid IDs before database access", async () => {
    await expect(updateBusinessApplicationStatus("not-an-id", "under_review", undefined, REVIEWER_ID)).rejects.toBeInstanceOf(BusinessApplicationNotFoundError);
  });

  it("approval creates a business without publishing it", async () => {
    state.current.status = "under_review";
    const result = await updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID);
    expect(result.status).toBe("approved");

    expect(state.businesses).toHaveLength(1);
    expect(state.businesses[0]).toMatchObject({
      applicationId: state.current.id,
      ownerUserId: "owner-1",
      name: "Aqua Kasarani",
      isPublished: false,
      isComplete: false,
    });
  });

  it("links an existing business record instead of creating a second one", async () => {
    state.current.status = "under_review";
    state.businesses.push({
      id: "biz-existing",
      applicationId: state.current.id,
      ownerUserId: "owner-1",
      name: "Aqua Kasarani",
      slug: "aqua-kasarani",
      isComplete: false,
      isPublished: false,
    });

    const result = await updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID);

    expect(result.status).toBe("approved");
    expect(state.businesses).toHaveLength(1);
    expect(state.businesses[0]?.id).toBe("biz-existing");
  });

  it("falls back to an application-specific slug when the base slug is taken", async () => {
    state.current.status = "under_review";
    state.businesses.push({
      id: "biz-other",
      applicationId: "22222222-2222-4222-8222-222222222222",
      ownerUserId: "owner-2",
      name: "Aqua Kasarani",
      slug: "aqua-kasarani",
      isComplete: true,
      isPublished: true,
    });

    const result = await updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID);

    expect(result.status).toBe("approved");
    expect(state.businesses).toHaveLength(2);
    expect(state.businesses[1]).toMatchObject({
      applicationId: state.current.id,
      slug: `aqua-kasarani-${state.current.id.replace(/-/g, "")}`,
    });
  });

  it("rolls the approval back when business creation fails", async () => {
    state.current.status = "under_review";
    state.failBusinessInsert = true;

    await expect(updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID)).rejects.toThrow(
      "connection to database terminated"
    );

    expect(state.current.status).toBe("under_review");
    expect(state.businesses).toHaveLength(0);
  });

  it("allows approval to be retried once the business creation failure is resolved", async () => {
    state.current.status = "under_review";
    state.failBusinessInsert = true;
    await expect(updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID)).rejects.toThrow(
      "connection to database terminated"
    );

    state.failBusinessInsert = false;
    const result = await updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID);

    expect(result.status).toBe("approved");
    expect(state.current.status).toBe("approved");
    expect(state.businesses).toHaveLength(1);
    expect(state.businesses[0]).toMatchObject({ applicationId: state.current.id });
  });

  it("allows only one of two concurrent approvals to commit a business record", async () => {
    state.current.status = "under_review";

    const outcomes = await Promise.allSettled([
      updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID),
      updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(state.current.status).toBe("approved");
    expect(state.businesses).toHaveLength(1);
  });

  it("blocks an operations reviewer from approving their own application", async () => {
    state.current.status = "under_review";

    await expect(
      updateBusinessApplicationStatus(state.current.id, "approved", undefined, state.current.ownerUserId)
    ).rejects.toBeInstanceOf(BusinessApplicationSelfReviewError);

    expect(state.current.status).toBe("under_review");
    expect(state.businesses).toHaveLength(0);
    expect(state.updated).toBeNull();
  });

  it("blocks an operations reviewer from rejecting their own application", async () => {
    state.current.status = "under_review";

    await expect(
      updateBusinessApplicationStatus(state.current.id, "rejected", "Not eligible", state.current.ownerUserId)
    ).rejects.toBeInstanceOf(BusinessApplicationSelfReviewError);

    expect(state.current.status).toBe("under_review");
    expect(state.current.rejectionReason).toBeNull();
    expect(state.updated).toBeNull();
  });

  it("lets a different reviewer decide after a blocked self-review", async () => {
    state.current.status = "under_review";
    await expect(
      updateBusinessApplicationStatus(state.current.id, "approved", undefined, state.current.ownerUserId)
    ).rejects.toBeInstanceOf(BusinessApplicationSelfReviewError);

    const result = await updateBusinessApplicationStatus(state.current.id, "approved", undefined, REVIEWER_ID);

    expect(result.status).toBe("approved");
    expect(state.businesses).toHaveLength(1);
  });

  it("duplicate approval or retry cannot create duplicate business records", async () => {
    const app = {
      id: "11111111-1111-4111-8111-111111111111",
      ownerUserId: "owner-1",
      businessName: "Aqua Kasarani",
    };
    const executor = (await getDatabase()).db as unknown as BusinessRecordExecutor;

    const first = await ensureBusinessForApplication(app, executor);
    expect(first).toBeDefined();
    expect(state.businesses).toHaveLength(1);

    const second = await ensureBusinessForApplication(app, executor);
    expect(second).toBeDefined();
    expect(state.businesses).toHaveLength(1);
    expect(first.id).toBe(second.id);
  });
});
