import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authorization: { user: null as unknown, response: null as Response | null },
  applications: [{ id: "application-1", status: "submitted" }],
}));

vi.mock("@/lib/server/operations-authorization", () => ({
  authorizeOperationsRequest: vi.fn(async () => state.authorization),
}));
vi.mock("@/lib/server/business-applications", () => ({
  listAllBusinessApplications: vi.fn(async () => state.applications),
}));

import { GET } from "./route";

describe("GET /api/admin/business-applications", () => {
  it("returns 401 for unauthenticated requests", async () => {
    state.authorization = { user: null, response: Response.json({ error: "required" }, { status: 401 }) };
    expect((await GET()).status).toBe(401);
  });

  it("returns 403 for authenticated non-operations users", async () => {
    state.authorization = { user: null, response: Response.json({ error: "forbidden" }, { status: 403 }) };
    expect((await GET()).status).toBe(403);
  });

  it("lists applications for operations users", async () => {
    state.authorization = { user: { id: "ops-1" }, response: null };
    const response = await GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ applications: state.applications });
  });
});
