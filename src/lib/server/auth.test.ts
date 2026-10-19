import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  token: "session-token",
  deletedCondition: null as unknown,
  deleteCookie: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => (state.token ? { value: state.token } : undefined),
    delete: state.deleteCookie,
  })),
}));

vi.mock("@/lib/server/db", () => ({
  getDatabase: async () => ({ db: {
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

import { logoutCurrentSession } from "./auth";

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
