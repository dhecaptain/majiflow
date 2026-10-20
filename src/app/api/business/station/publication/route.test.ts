import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AuthenticationError extends Error {}
  class StationNotFoundError extends Error {}
  class StationUnauthorizedError extends Error {}
  class StationPublicationError extends Error {}
  return {
    AuthenticationError,
    StationNotFoundError,
    StationUnauthorizedError,
    StationPublicationError,
  };
});

vi.mock("@/lib/server/auth", () => ({
  AuthenticationError: mocks.AuthenticationError,
  requireBusinessOwner: vi.fn(async () => ({ id: "owner-1", role: "business_owner" })),
}));

vi.mock("@/lib/server/station-publication", () => ({
  StationNotFoundError: mocks.StationNotFoundError,
  StationUnauthorizedError: mocks.StationUnauthorizedError,
  StationPublicationError: mocks.StationPublicationError,
  publishBusiness: vi.fn(async () => ({ id: "biz-1", isPublished: true })),
}));

import { POST } from "./route";
import { requireBusinessOwner } from "@/lib/server/auth";
import { publishBusiness } from "@/lib/server/station-publication";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/business/station/publication", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/business/station/publication", () => {
  beforeEach(() => {
    vi.mocked(publishBusiness).mockClear();
  });

  it("publishes through the authoritative service for the signed-in owner", async () => {
    const response = await POST(jsonRequest({ businessId: "biz-1" }));

    expect(response.status).toBe(200);
    expect(publishBusiness).toHaveBeenCalledWith("biz-1", "owner-1");

    const body = await response.json();
    expect(body.business.isPublished).toBe(true);
  });

  it("ignores client-supplied publication and completion flags", async () => {
    await POST(
      jsonRequest({
        businessId: "biz-1",
        isPublished: false,
        isComplete: true,
        status: "approved",
      })
    );

    expect(publishBusiness).toHaveBeenCalledWith("biz-1", "owner-1");
    expect(publishBusiness).toHaveBeenCalledTimes(1);
  });

  it("rejects publication when the authoritative gate refuses", async () => {
    vi.mocked(publishBusiness).mockRejectedValueOnce(
      new mocks.StationPublicationError("The business listing is incomplete.")
    );

    const response = await POST(jsonRequest({ businessId: "biz-1" }));
    expect(response.status).toBe(422);
  });

  it("rejects requests for businesses the owner does not own", async () => {
    vi.mocked(publishBusiness).mockRejectedValueOnce(
      new mocks.StationUnauthorizedError("You do not have permission to publish this business.")
    );

    const response = await POST(jsonRequest({ businessId: "someone-elses-biz" }));
    expect(response.status).toBe(403);
  });

  it("returns not found for unknown businesses", async () => {
    vi.mocked(publishBusiness).mockRejectedValueOnce(
      new mocks.StationNotFoundError("Business was not found.")
    );

    const response = await POST(jsonRequest({ businessId: "missing-biz" }));
    expect(response.status).toBe(404);
  });

  it("rejects requests without a business", async () => {
    const response = await POST(jsonRequest({}));
    expect(response.status).toBe(400);
    expect(publishBusiness).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(requireBusinessOwner).mockRejectedValueOnce(
      new mocks.AuthenticationError("Business owner access is required.")
    );

    const response = await POST(jsonRequest({ businessId: "biz-1" }));
    expect(response.status).toBe(401);
    expect(publishBusiness).not.toHaveBeenCalled();
  });
});
