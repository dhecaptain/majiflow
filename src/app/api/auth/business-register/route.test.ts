import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  AuthenticationError: class AuthenticationError extends Error {},
  createSession: vi.fn(),
  createUserAccount: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => auth);
vi.mock("@/lib/monitoring", () => ({
  reportFailure: vi.fn(),
}));

import { POST } from "./route";

describe("POST /api/auth/business-register", () => {
  beforeEach(() => {
    auth.createSession.mockReset();
    auth.createUserAccount.mockReset();
    auth.createUserAccount.mockResolvedValue({
      id: "owner-1",
      name: "Owner",
      email: "owner@example.com",
      role: "business_owner",
    });
  });

  it("creates a business-owner account", async () => {
    const response = await POST(new Request("http://localhost/api/auth/business-register", {
      method: "POST",
      body: JSON.stringify({ name: "Owner", email: "owner@example.com", password: "password123" }),
    }));

    expect(response.status).toBe(201);
    expect(auth.createUserAccount).toHaveBeenCalledWith(
      { name: "Owner", email: "owner@example.com", password: "password123" },
      "business_owner"
    );
    expect(auth.createSession).toHaveBeenCalledWith("owner-1");
  });

  it("returns a conflict for a wrapped duplicate-email error", async () => {
    auth.createUserAccount.mockRejectedValue({
      name: "DrizzleQueryError",
      cause: { code: "23505" },
    });

    const response = await POST(new Request("http://localhost/api/auth/business-register", {
      method: "POST",
      body: JSON.stringify({ name: "Owner", email: "owner@example.com", password: "password123" }),
    }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "An account with this email already exists." });
  });

  it("returns a generic error for unrelated persistence failures", async () => {
    auth.createUserAccount.mockRejectedValue({ name: "DatabaseError", code: "ECONNRESET" });

    const response = await POST(new Request("http://localhost/api/auth/business-register", {
      method: "POST",
      body: JSON.stringify({ name: "Owner", email: "owner@example.com", password: "password123" }),
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not create business owner account." });
  });
});
