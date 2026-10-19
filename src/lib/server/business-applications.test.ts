import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  inserted: null as Record<string, unknown> | null,
  ownerFilter: null as unknown,
}));

vi.mock("@/lib/server/db", () => ({
  getDatabase: async () => ({ db: {
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        returning: async () => {
          state.inserted = value;
          return [{ id: "application-1", ...value }];
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: (filter: unknown) => {
          state.ownerFilter = filter;
          return {
            orderBy: async () => [{ id: "application-1", ownerUserId: "owner-1" }],
          };
        },
      }),
    }),
  } }),
}));

import { createBusinessApplication, listOwnerApplications } from "./business-applications";

const validInput = {
  businessName: "Clear Water",
  ownerName: "Amina Yusuf",
  phone: "+254712345678",
  email: "amina@example.com",
  address: "Kasarani Road",
  city: "Nairobi",
  deliveryFee: "50",
  deliveryTimeMinutes: "45",
  plan: "growth",
};

describe("business application persistence service", () => {
  beforeEach(() => {
    state.inserted = null;
    state.ownerFilter = null;
  });

  it("rejects invalid input before persistence", async () => {
    const result = await createBusinessApplication("owner-1", { ...validInput, plan: "invalid" });

    expect(result).toEqual({
      success: false,
      errors: { plan: "Plan is invalid" },
    });
    expect(state.inserted).toBeNull();
  });

  it("persists submitted applications with the authenticated owner and server status", async () => {
    const result = await createBusinessApplication("owner-1", validInput);

    expect(result.success).toBe(true);
    expect(state.inserted).toMatchObject({
      ownerUserId: "owner-1",
      status: "submitted",
      businessName: "Clear Water",
    });
  });

  it("scopes listing through the supplied owner filter", async () => {
    const applications = await listOwnerApplications("owner-1");

    expect(applications).toEqual([{ id: "application-1", ownerUserId: "owner-1" }]);
    expect(state.ownerFilter).toBeTruthy();
  });
});
