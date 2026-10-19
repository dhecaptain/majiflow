import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  AuthenticationError: class AuthenticationError extends Error {},
  authenticateUser: vi.fn(),
  createSession: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => auth);

import { POST } from "./route";

describe("POST /api/auth/login", () => {
  it("creates a session and returns the business-owner identity", async () => {
    auth.authenticateUser.mockResolvedValueOnce({
      id: "owner-1",
      name: "Owner",
      email: "owner@example.com",
      role: "business_owner",
    });

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "owner@example.com", password: "password123" }),
    }));

    expect(response.status).toBe(200);
    expect(auth.createSession).toHaveBeenCalledWith("owner-1");
    await expect(response.json()).resolves.toEqual({
      user: { id: "owner-1", name: "Owner", email: "owner@example.com", role: "business_owner" },
    });
  });

  it("creates a session and returns the customer identity", async () => {
    auth.authenticateUser.mockResolvedValueOnce({
      id: "customer-1",
      name: "Customer",
      email: "customer@example.com",
      role: "customer",
    });

    const response = await POST(new Request("http://localhost/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "customer@example.com", password: "password123" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      user: { id: "customer-1", name: "Customer", email: "customer@example.com", role: "customer" },
    });
  });
});
