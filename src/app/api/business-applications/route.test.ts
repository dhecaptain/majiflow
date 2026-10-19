import { describe, expect, it, vi } from "vitest";

const authError = vi.hoisted(() => class AuthenticationError extends Error {});

vi.mock("@/lib/server/auth", () => ({
  AuthenticationError: authError,
  requireBusinessOwner: vi.fn(async () => {
    throw new authError("Authentication is required.");
  }),
}));

vi.mock("@/lib/server/business-applications", () => ({
  createBusinessApplication: vi.fn(),
  listOwnerApplications: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/business-applications", () => {
  it("rejects unauthenticated submissions", async () => {
    const response = await POST(
      new Request("http://localhost/api/business-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(401);
  });
});
