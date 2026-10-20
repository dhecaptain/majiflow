import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AuthenticationError extends Error {}
  class SubscriptionError extends Error {}
  class SubscriptionConflictError extends SubscriptionError {}
  class SubscriptionNotFoundError extends Error {}
  class SubscriptionUnauthorizedError extends Error {}
  return {
    AuthenticationError,
    SubscriptionError,
    SubscriptionConflictError,
    SubscriptionNotFoundError,
    SubscriptionUnauthorizedError,
  };
});

vi.mock("@/lib/server/auth", () => ({
  AuthenticationError: mocks.AuthenticationError,
  requireBusinessOwner: vi.fn(async () => ({ id: "owner-1", role: "business_owner" })),
}));

vi.mock("@/lib/server/subscriptions", () => ({
  planNames: ["starter", "growth", "pro"],
  SubscriptionError: mocks.SubscriptionError,
  SubscriptionConflictError: mocks.SubscriptionConflictError,
  SubscriptionNotFoundError: mocks.SubscriptionNotFoundError,
  SubscriptionUnauthorizedError: mocks.SubscriptionUnauthorizedError,
  startFreeTrial: vi.fn(async () => ({ id: "sub-1", status: "trialing", plan: "growth" })),
}));

import { POST } from "./route";
import { requireBusinessOwner } from "@/lib/server/auth";
import { startFreeTrial } from "@/lib/server/subscriptions";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/business/station/trial", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/business/station/trial", () => {
  beforeEach(() => {
    vi.mocked(startFreeTrial).mockClear();
  });

  it("starts a trial with server-side defaults and ignores client-supplied timestamps and status", async () => {
    const response = await POST(
      jsonRequest({
        businessId: "biz-1",
        plan: "growth",
        now: "2020-01-01T00:00:00.000Z",
        trialStartedAt: "2020-01-01T00:00:00.000Z",
        trialEndsAt: "2030-01-01T00:00:00.000Z",
        status: "active",
        paymentConfirmedAt: "2020-01-01T00:00:00.000Z",
      })
    );

    expect(response.status).toBe(201);
    expect(startFreeTrial).toHaveBeenCalledWith("biz-1", "owner-1", "growth");
  });

  it("rejects requests without a business", async () => {
    const response = await POST(jsonRequest({ plan: "growth" }));
    expect(response.status).toBe(400);
    expect(startFreeTrial).not.toHaveBeenCalled();
  });

  it("rejects an unsupported plan before touching the service", async () => {
    const response = await POST(jsonRequest({ businessId: "biz-1", plan: "enterprise" }));
    expect(response.status).toBe(400);
    expect(startFreeTrial).not.toHaveBeenCalled();
  });

  it("returns a controlled conflict when a duplicate trial is attempted", async () => {
    vi.mocked(startFreeTrial).mockRejectedValueOnce(
      new mocks.SubscriptionConflictError("A subscription or trial already exists for this business.")
    );

    const response = await POST(jsonRequest({ businessId: "biz-1" }));
    expect(response.status).toBe(409);
  });

  it("rejects trials for applications that are not approved", async () => {
    vi.mocked(startFreeTrial).mockRejectedValueOnce(
      new mocks.SubscriptionError("A free trial can only be started for an approved application.")
    );

    const response = await POST(jsonRequest({ businessId: "biz-1" }));
    expect(response.status).toBe(422);
  });

  it("rejects requests for businesses the owner does not own", async () => {
    vi.mocked(startFreeTrial).mockRejectedValueOnce(
      new mocks.SubscriptionUnauthorizedError("You do not own this business.")
    );

    const response = await POST(jsonRequest({ businessId: "someone-elses-biz" }));
    expect(response.status).toBe(403);
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(requireBusinessOwner).mockRejectedValueOnce(
      new mocks.AuthenticationError("Business owner access is required.")
    );

    const response = await POST(jsonRequest({ businessId: "biz-1" }));
    expect(response.status).toBe(401);
    expect(startFreeTrial).not.toHaveBeenCalled();
  });
});
