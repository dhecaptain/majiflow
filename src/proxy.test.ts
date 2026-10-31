import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function call(path: string, method: string, headers: Record<string, string> = {}) {
  return proxy(new NextRequest(`https://majiflow.co.ke${path}`, { method, headers: { host: "majiflow.co.ke", ...headers } }));
}

describe("API cross-site guard", () => {
  it("refuses a state-changing request from another site", () => {
    expect(call("/api/orders", "POST", { "sec-fetch-site": "cross-site" }).status).toBe(403);
    expect(call("/api/orders", "POST", { origin: "https://evil.example" }).status).toBe(403);
    expect(call("/api/orders", "DELETE", { origin: "null" }).status).toBe(403);
  });

  it("lets the site itself and server-to-server callers through", () => {
    expect(call("/api/orders", "POST", { "sec-fetch-site": "same-origin", origin: "https://majiflow.co.ke" }).status).toBe(200);
    expect(call("/api/payments/refunds", "POST", { authorization: "Bearer key" }).status).toBe(200);
    expect(call("/api/orders", "GET", { origin: "https://evil.example" }).status).toBe(200);
  });

  it("exempts provider callbacks and cron, which carry their own secrets", () => {
    expect(call("/api/payments/callback?token=x", "POST", { origin: "https://safaricom.example" }).status).toBe(200);
    expect(call("/api/cron/retention", "POST", { "sec-fetch-site": "cross-site" }).status).toBe(200);
  });
});
