import { afterEach, describe, expect, it } from "vitest";
import { clientIp, hit, limitResponse } from "./rate-limit";

/** The in-process fallback; the shared Postgres counters run the same rules. */
describe("rate limits", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("lets a caller in up to the limit, then stops them until the window ends", async () => {
    const rule = { limit: 3, windowMs: 60_000 };
    const now = 1_000_000;
    for (let i = 0; i < 3; i += 1) expect((await hit("t:a", rule, now)).ok).toBe(true);
    const blocked = await hit("t:a", rule, now + 1000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(59);
    expect((await hit("t:a", rule, now + 61_000)).ok).toBe(true);
  });

  it("keeps separate keys apart", async () => {
    const rule = { limit: 1, windowMs: 60_000 };
    expect((await hit("t:b", rule)).ok).toBe(true);
    expect((await hit("t:c", rule)).ok).toBe(true);
    expect((await hit("t:b", rule)).ok).toBe(false);
  });

  it("answers 429 with Retry-After", async () => {
    const rule = { limit: 1, windowMs: 30_000 };
    expect(await limitResponse([{ key: "t:d", rule }])).toBeNull();
    const response = await limitResponse([{ key: "t:d", rule }]);
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);
  });

  it("reads the platform's client address", () => {
    const request = (headers: Record<string, string>) => new Request("http://x", { headers });
    expect(clientIp(request({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "1.1.1.1" }))).toBe("198.51.100.1");
    expect(clientIp(request({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(request({}))).toBe("unknown");
  });
});
