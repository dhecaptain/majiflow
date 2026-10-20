import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authorization: { user: { id: "ops-1" } as unknown, response: null as Response | null },
  update: vi.fn(),
}));

vi.mock("@/lib/server/operations-authorization", () => ({
  authorizeOperationsRequest: vi.fn(async () => state.authorization),
}));
vi.mock("@/lib/server/business-applications", () => ({
  BusinessApplicationConflictError: class extends Error {},
  BusinessApplicationNotFoundError: class extends Error {},
  BusinessApplicationSelfReviewError: class extends Error {},
  BusinessApplicationTransitionError: class extends Error {},
  updateBusinessApplicationStatus: state.update,
}));

import { PATCH } from "./route";

describe("PATCH /api/admin/business-applications/:id", () => {
  beforeEach(() => {
    state.authorization = { user: { id: "ops-1" }, response: null };
    state.update.mockReset();
  });

  it("returns 401 for unauthenticated requests", async () => {
    state.authorization = { user: null, response: Response.json({ error: "required" }, { status: 401 }) };
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "application-1" }) });
    expect(response.status).toBe(401);
  });

  it("returns 403 for authenticated non-operations users", async () => {
    state.authorization = { user: null, response: Response.json({ error: "forbidden" }, { status: 403 }) };
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "application-1" }) });
    expect(response.status).toBe(403);
  });

  it("rejects invalid status values", async () => {
    state.authorization = { user: { id: "ops-1" }, response: null };
    const TransitionError = (await import("@/lib/server/business-applications")).BusinessApplicationTransitionError;
    state.update.mockRejectedValueOnce(new TransitionError("Status is invalid."));
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "invalid" }) }), { params: Promise.resolve({ id: "application-1" }) });
    expect(response.status).toBe(422);
  });

  it("returns validation errors for a missing rejection reason", async () => {
    const TransitionError = (await import("@/lib/server/business-applications")).BusinessApplicationTransitionError;
    state.update.mockRejectedValueOnce(new TransitionError("A rejection reason is required."));
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected" }),
    }), { params: Promise.resolve({ id: "application-1" }) });
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ error: "A rejection reason is required." });
  });

  it("returns the persisted application after a valid decision", async () => {
    state.update.mockResolvedValueOnce({ id: "application-1", status: "approved" });
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "approved" }) }), { params: Promise.resolve({ id: "application-1" }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ application: { id: "application-1", status: "approved" } });
    expect(state.update).toHaveBeenCalledWith("application-1", "approved", undefined, "ops-1");
  });

  it("returns not found for a missing application", async () => {
    const NotFound = (await import("@/lib/server/business-applications")).BusinessApplicationNotFoundError;
    state.update.mockRejectedValueOnce(new NotFound("Application was not found."));
    const response = await PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ status: "under_review" }) }), { params: Promise.resolve({ id: "missing" }) });
    expect(response.status).toBe(404);
  });

  it("returns conflict when the application changed concurrently", async () => {
    const ConflictError = (await import("@/lib/server/business-applications")).BusinessApplicationConflictError;
    state.update.mockRejectedValueOnce(new ConflictError("The application changed before this update completed."));
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
    }), { params: Promise.resolve({ id: "application-1" }) });
    expect(response.status).toBe(409);
  });

  it("returns 403 when an operations user decides their own application", async () => {
    const SelfReviewError = (await import("@/lib/server/business-applications")).BusinessApplicationSelfReviewError;
    state.update.mockRejectedValueOnce(new SelfReviewError("Operations reviewers cannot decide their own business application."));
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected", rejectionReason: "Not eligible" }),
    }), { params: Promise.resolve({ id: "application-1" }) });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Operations reviewers cannot decide their own business application." });
  });

  it("ignores reviewer identity supplied in the request body", async () => {
    state.update.mockResolvedValueOnce({ id: "application-1", status: "approved" });
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved", reviewerUserId: "attacker", ownerUserId: "attacker" }),
    }), { params: Promise.resolve({ id: "application-1" }) });
    expect(response.status).toBe(200);
    expect(state.update).toHaveBeenCalledWith("application-1", "approved", undefined, "ops-1");
  });
});
