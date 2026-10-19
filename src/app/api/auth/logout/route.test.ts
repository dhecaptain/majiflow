import { describe, expect, it, vi } from "vitest";

const logoutCurrentSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => ({ logoutCurrentSession }));

import { POST } from "./route";

describe("POST /api/auth/logout", () => {
  it("revokes the current session and confirms logout", async () => {
    const response = await POST();

    expect(response.status).toBe(200);
    expect(logoutCurrentSession).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("does not expose database errors", async () => {
    logoutCurrentSession.mockRejectedValueOnce(new Error("database secret"));

    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Could not sign out." });
  });
});
