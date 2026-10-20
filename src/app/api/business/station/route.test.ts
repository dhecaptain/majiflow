import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class AuthenticationError extends Error {}
  return { AuthenticationError };
});

vi.mock("@/lib/server/auth", () => ({
  AuthenticationError: mocks.AuthenticationError,
  requireBusinessOwner: vi.fn(async () => ({ id: "owner-1", role: "business_owner" })),
}));

vi.mock("@/lib/server/owner-stations", () => ({
  listOwnerStations: vi.fn(async () => [
    { business: { id: "biz-1", name: "Lake Aqua Clean" } },
  ]),
}));

import { GET } from "./route";
import { requireBusinessOwner } from "@/lib/server/auth";
import { listOwnerStations } from "@/lib/server/owner-stations";

describe("GET /api/business/station", () => {
  it("returns the signed-in owner's stations", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.stations).toHaveLength(1);
    expect(listOwnerStations).toHaveBeenCalledWith("owner-1");
  });

  it("rejects unauthenticated or non-owner requests", async () => {
    vi.mocked(requireBusinessOwner).mockRejectedValueOnce(
      new mocks.AuthenticationError("Business owner access is required.")
    );

    const response = await GET();
    expect(response.status).toBe(401);
  });
});
