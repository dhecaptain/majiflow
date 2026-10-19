import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  AuthenticationError: class AuthenticationError extends Error {},
  createSession: vi.fn(),
  createUserAccount: vi.fn(async (input: unknown, role?: string) => ({
    id: "customer-1",
    role: role ?? "customer",
    input,
  })),
}));

vi.mock("@/lib/server/auth", () => auth);

import { POST } from "./route";

describe("POST /api/auth/register", () => {
  it("creates an ordinary customer without accepting a privileged role", async () => {
    const response = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Customer",
        email: "customer@example.com",
        password: "password123",
        role: "business_owner",
      }),
    }));

    expect(response.status).toBe(201);
    expect(auth.createUserAccount).toHaveBeenCalledWith(expect.objectContaining({
      name: "Customer",
      role: "business_owner",
    }));
    expect(auth.createUserAccount.mock.calls[0]).toHaveLength(1);
  });

  it("rejects malformed JSON before touching persistence", async () => {
    auth.createUserAccount.mockClear();
    const response = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }));

    expect(response.status).toBe(400);
    expect(auth.createUserAccount).not.toHaveBeenCalled();
  });
});
