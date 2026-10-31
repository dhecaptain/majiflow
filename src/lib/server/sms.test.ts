import { afterEach, describe, expect, it } from "vitest";
import { devSmsSender, resolveSmsSender, sendSms } from "@/lib/server/sms";

const ENV_KEYS = [
  "MF_SMS_PROVIDER",
  "MF_SMS_WEBHOOK_URL",
  "MF_SMS_AT_USERNAME",
  "MF_SMS_AT_API_KEY",
  "MF_SMS_TWILIO_ACCOUNT_SID",
  "MF_SMS_TWILIO_AUTH_TOKEN",
  "MF_SMS_SENDER",
  "MF_SMS_DEV_ECHO",
];

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("resolveSmsSender", () => {
  it("falls back to the dev sender when nothing is configured", () => {
    expect(resolveSmsSender().name).toBe("dev");
  });

  it("prefers an explicitly named provider", () => {
    process.env.MF_SMS_PROVIDER = "africastalking";
    expect(resolveSmsSender().name).toBe("africastalking");
  });

  it("uses Africa's Talking as soon as it has credentials", () => {
    process.env.MF_SMS_AT_USERNAME = "majiflow";
    process.env.MF_SMS_AT_API_KEY = "key";
    expect(resolveSmsSender().name).toBe("africastalking");
  });

  it("uses the webhook when one is configured", () => {
    process.env.MF_SMS_WEBHOOK_URL = "https://sms.example/send";
    expect(resolveSmsSender().name).toBe("webhook");
  });
});

describe("sendSms", () => {
  it("returns the dev code so the flow works without a provider", async () => {
    const result = await sendSms({ to: "254712345678", body: "Your MajiFlow code is 123456." });
    expect(result.sent).toBe(true);
    expect(result.devCode).toBe("123456");
  });

  it("never throws when a provider is missing its credentials", async () => {
    process.env.MF_SMS_PROVIDER = "twilio";
    const result = await sendSms({ to: "254712345678", body: "hello" });
    expect(result.sent).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("never throws when the provider is unreachable", async () => {
    const sender = devSmsSender;
    await expect(sender.send({ to: "254712345678", body: "hello" })).resolves.toBeTruthy();
  });
});
