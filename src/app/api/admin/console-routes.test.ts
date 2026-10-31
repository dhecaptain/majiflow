import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  adminCookie: true,
  authorization: { user: { id: "ops-1" } as unknown, response: null as Response | null },
  suspend: vi.fn(),
  disable: vi.fn(),
  revalidate: vi.fn(),
}));

vi.mock("@/lib/server/admin", () => ({ isAdminRequest: vi.fn(() => state.adminCookie) }));
vi.mock("@/lib/server/operations-authorization", () => ({
  authorizeOperationsRequest: vi.fn(async () => state.authorization),
}));
vi.mock("@/lib/server/catalog", () => ({ revalidateStations: state.revalidate }));
vi.mock("@/lib/server/admin-insights", () => ({
  AdminActionError: class AdminActionError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  },
  setStationSuspended: state.suspend,
  setUserDisabled: state.disable,
}));

import { AdminActionError } from "@/lib/server/admin-insights";
import { PATCH as patchStation } from "./stations/[id]/route";
import { PATCH as patchUser } from "./users/[id]/route";

const ID = "7f1c3f0e-1b7a-4c51-9a55-4d8c0c0f2f10";
const req = (body: unknown) =>
  new Request("http://localhost", { method: "PATCH", body: typeof body === "string" ? body : JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: ID }) };

describe("admin console write routes", () => {
  beforeEach(() => {
    state.adminCookie = true;
    state.authorization = { user: { id: "ops-1" }, response: null };
    state.suspend.mockReset();
    state.disable.mockReset();
    state.revalidate.mockReset();
  });

  it("refuse callers without the admin key session, even operations accounts", async () => {
    state.adminCookie = false;
    expect((await patchStation(req({ suspended: true, reason: "x" }), ctx)).status).toBe(401);
    expect((await patchUser(req({ disabled: true }), ctx)).status).toBe(401);
    expect(state.suspend).not.toHaveBeenCalled();
    expect(state.disable).not.toHaveBeenCalled();
  });

  it("refuse signed-in accounts that are not operations", async () => {
    state.authorization = { user: null, response: Response.json({ error: "forbidden" }, { status: 403 }) };
    expect((await patchStation(req({ suspended: true, reason: "x" }), ctx)).status).toBe(403);
  });

  it("validate the body", async () => {
    expect((await patchStation(req({ suspended: "yes" }), ctx)).status).toBe(400);
    expect((await patchUser(req("not json"), ctx)).status).toBe(400);
  });

  it("suspends a station and refreshes the public catalog", async () => {
    state.suspend.mockResolvedValue({ id: ID, suspendedAt: new Date() });
    const response = await patchStation(req({ suspended: true, reason: "Expired licence" }), ctx);
    expect(response.status).toBe(200);
    expect(state.suspend).toHaveBeenCalledWith(ID, true, "Expired licence");
    expect(state.revalidate).toHaveBeenCalled();
  });

  it("passes the acting operator so they cannot disable themselves", async () => {
    state.disable.mockRejectedValue(new AdminActionError("You cannot disable your own account.", 409));
    const response = await patchUser(req({ disabled: true }), ctx);
    expect(response.status).toBe(409);
    expect(state.disable).toHaveBeenCalledWith(ID, true, "ops-1");
  });
});
