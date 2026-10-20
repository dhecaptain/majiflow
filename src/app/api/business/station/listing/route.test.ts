import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AuthenticationError extends Error {}
  class ListingIncompleteError extends Error {
    constructor(
      message: string,
      public readonly missingFields: string[]
    ) {
      super(message);
    }
  }
  class StationNotFoundError extends Error {}
  class StationUnauthorizedError extends Error {}
  class StationPublicationError extends Error {}
  return {
    AuthenticationError,
    ListingIncompleteError,
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
  ListingIncompleteError: mocks.ListingIncompleteError,
  StationNotFoundError: mocks.StationNotFoundError,
  StationUnauthorizedError: mocks.StationUnauthorizedError,
  StationPublicationError: mocks.StationPublicationError,
  completeBusinessListing: vi.fn(async () => ({ id: "biz-1", isComplete: true })),
}));

import { POST } from "./route";
import { requireBusinessOwner } from "@/lib/server/auth";
import { completeBusinessListing } from "@/lib/server/station-publication";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/business/station/listing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/business/station/listing", () => {
  beforeEach(() => {
    vi.mocked(completeBusinessListing).mockClear();
  });

  it("forwards only listing fields and never client-set completion flags", async () => {
    const response = await POST(
      jsonRequest({
        businessId: "biz-1",
        businessName: "Lake Aqua Clean",
        description: "A validated description for the listing.",
        zones: "Milimani, Tom Mboya",
        deliveryFee: 100,
        deliveryTimeMinutes: "30",
        latitude: "-0.0917",
        longitude: "34.768",
        isComplete: true,
        isPublished: true,
        status: "approved",
        paymentConfirmedAt: "2020-01-01T00:00:00.000Z",
      })
    );

    expect(response.status).toBe(200);
    expect(completeBusinessListing).toHaveBeenCalledWith("biz-1", "owner-1", {
      businessName: "Lake Aqua Clean",
      description: "A validated description for the listing.",
      zones: "Milimani, Tom Mboya",
      deliveryFee: 100,
      deliveryTimeMinutes: "30",
      latitude: "-0.0917",
      longitude: "34.768",
    });
  });

  it("reports the remaining required fields when the listing cannot be completed", async () => {
    vi.mocked(completeBusinessListing).mockRejectedValueOnce(
      new mocks.ListingIncompleteError(
        "Listing cannot be completed because required fields are missing: zones, latitude",
        ["zones", "latitude"]
      )
    );

    const response = await POST(jsonRequest({ businessId: "biz-1", zones: "" }));
    expect(response.status).toBe(422);

    const body = await response.json();
    expect(body.missingFields).toEqual(["zones", "latitude"]);
  });

  it("rejects malformed field values before calling the service", async () => {
    const response = await POST(
      jsonRequest({ businessId: "biz-1", latitude: { nope: true }, deliveryFee: true })
    );

    expect(response.status).toBe(400);
    expect(completeBusinessListing).not.toHaveBeenCalled();
  });

  it("rejects requests without a business", async () => {
    const response = await POST(jsonRequest({ zones: "Milimani" }));
    expect(response.status).toBe(400);
    expect(completeBusinessListing).not.toHaveBeenCalled();
  });

  it("rejects requests for businesses the owner does not own", async () => {
    vi.mocked(completeBusinessListing).mockRejectedValueOnce(
      new mocks.StationUnauthorizedError("You do not have permission to modify this business.")
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
    expect(completeBusinessListing).not.toHaveBeenCalled();
  });
});
