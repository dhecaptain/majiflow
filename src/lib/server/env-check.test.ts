import { afterEach, describe, expect, it, vi } from "vitest";
import { productionEnvProblems } from "./env-check";

const complete = {
  DATABASE_URL: "postgresql://db",
  MF_OTP_SECRET: "x",
  MF_ADMIN_KEY: "x",
  CRON_SECRET: "x",
  MF_ALERT_WEBHOOK_URL: "https://alerts",
  NEXT_PUBLIC_SITE_URL: "https://majiflow.co.ke",
  MF_SMS_AT_USERNAME: "u",
  MF_SMS_AT_API_KEY: "k",
};

function withEnv(env: Record<string, string>) {
  for (const key of [...Object.keys(complete), "MF_DEMO_STATIONS", "MF_DATA_DIR", "MF_PAYMENTS_MODE", "DARAJA_CONSUMER_KEY"]) {
    vi.stubEnv(key, "");
  }
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return productionEnvProblems().map((p) => p.name);
}

describe("production configuration check", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is quiet when everything is set", () => {
    expect(withEnv(complete)).toEqual([]);
  });

  it("names every missing piece at once", () => {
    const names = withEnv({});
    expect(names).toEqual(expect.arrayContaining(["DATABASE_URL", "MF_OTP_SECRET", "MF_ADMIN_KEY", "CRON_SECRET", "NEXT_PUBLIC_SITE_URL"]));
    expect(names.some((n) => n.includes("MF_SMS"))).toBe(true);
  });

  it("flags a localhost site URL and Daraja without its callback token", () => {
    const names = withEnv({ ...complete, NEXT_PUBLIC_SITE_URL: "http://localhost:3000", MF_PAYMENTS_MODE: "daraja" });
    expect(names).toEqual(expect.arrayContaining(["NEXT_PUBLIC_SITE_URL", "MF_PAYMENTS_CALLBACK_TOKEN", "DARAJA_ENV"]));
  });
});
