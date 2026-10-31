import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const post = (body: unknown, ip = "198.51.100.9") =>
  POST(new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(body),
  }));

const valid = { name: "Jane Wanjiku", email: "jane@example.com", topic: "Something else", message: "Do you deliver to Ruaka?" };

describe("POST /api/contact", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("explains what is missing", async () => {
    const response = await post({ name: "J" }, "198.51.100.1");
    expect(response.status).toBe(422);
    expect(Object.keys((await response.json()).fields)).toEqual(["name", "email", "message"]);
  });

  it("answers 503 when no inbox is configured, so the page falls back to email", async () => {
    vi.stubEnv("MF_CONTACT_WEBHOOK_URL", "");
    vi.stubEnv("MF_ALERT_WEBHOOK_URL", "");
    expect((await post(valid, "198.51.100.2")).status).toBe(503);
  });

  it("delivers the message to the configured webhook", async () => {
    vi.stubEnv("MF_CONTACT_WEBHOOK_URL", "https://inbox.example/hook");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    expect((await post(valid, "198.51.100.3")).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith("https://inbox.example/hook", expect.objectContaining({ method: "POST" }));
  });
});
