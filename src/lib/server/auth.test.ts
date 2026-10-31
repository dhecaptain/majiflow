import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  token: "session-token",
  deletedCondition: null as unknown,
  deleteCookie: vi.fn(),
  phoneUser: null as { id: string; name: string; email: string | null; phone: string; role: string } | null,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    delete: state.deleteCookie,
  })),
}));

vi.mock("@/lib/server/db", () => ({
  getDatabase: async () => ({ db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => (state.phoneUser ? [state.phoneUser] : []) }),
      }),
    }),
    delete: () => ({
      where: async (condition: unknown) => {
        state.deletedCondition = condition;
      },
    }),
  } }),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: (column: unknown, value: unknown) => ({ column, value }),
  gt: vi.fn(),
}));

vi.mock("@/lib/server/db/schema", () => ({
  sessions: { tokenHash: "token_hash" },
  users: {},
}));

import { authenticatePhone, logoutCurrentSession } from "./auth";

describe("logoutCurrentSession", () => {
  beforeEach(() => {
    state.token = "session-token";
    state.deletedCondition = null;
    state.deleteCookie.mockClear();
  });

  it("deletes the hashed current session and clears its cookie", async () => {
    await logoutCurrentSession();

    expect(state.deletedCondition).toEqual({
      column: "token_hash",
      value: "c101e911469c969171040b50d70543313cf968fdef5bacc780776f8fb399ab36",
    });
    expect(state.deleteCookie).toHaveBeenCalledWith("mf_session");
  });

  it("clears an already-invalid cookie without deleting another session", async () => {
    state.token = "";

    await logoutCurrentSession();

    expect(state.deletedCondition).toBeNull();
    expect(state.deleteCookie).toHaveBeenCalledWith("mf_session");
  });
});

describe("authenticatePhone", () => {
  const owner = { id: "u1", name: "Wanjiru", email: null, phone: "0712345678" };

  it("signs in a customer who owns the number", async () => {
    state.phoneUser = { ...owner, role: "customer" };

    await expect(authenticatePhone("0712345678")).resolves.toMatchObject({ id: "u1", role: "customer" });
  });

  it.each(["business_owner", "operations"])("refuses an SMS-only sign-in for a %s account", async (role) => {
    state.phoneUser = { ...owner, role };

    await expect(authenticatePhone("0712345678")).rejects.toThrow("email and password");
  });
});
