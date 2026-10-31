/**
 * Outbound SMS.
 *
 * MajiFlow does not care which provider carries the text, so this module is a
 * thin seam over a handful of adapters. `MF_SMS_PROVIDER` picks one explicitly;
 * without it the first configured provider wins:
 *
 *   africastalking → webhook → twilio → dev
 *
 * The `dev` adapter never talks to a network. It logs the message and hands
 * the code back so the flow can be exercised end to end without a provider
 * account. Every adapter swallows its own failures: a text that cannot be
 * delivered must not take a signup down with it.
 */

import { reportFailure } from "@/lib/monitoring";

export interface SmsMessage {
  /** E.164 number, e.g. 254712345678. */
  to: string;
  body: string;
  /** Short tag so a provider can route the message, e.g. "otp" or "order". */
  purpose?: string;
}

export interface SmsSendResult {
  sent: boolean;
  provider: string;
  providerId?: string;
  /** Only ever set by the dev adapter, and only outside production. */
  devCode?: string;
  error?: string;
}

export interface SmsSender {
  name: string;
  send(message: SmsMessage): Promise<SmsSendResult>;
}

const REQUEST_TIMEOUT_MS = 8000;

/** Codes are echoed back to the caller only when a dev provider is in use. */
function devEchoEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.MF_SMS_DEV_ECHO !== "0";
}

function baseEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

async function postForm(url: string, form: URLSearchParams, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
      body: form,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Prints the message and, in development, returns the code it contains. */
export const devSmsSender: SmsSender = {
  name: "dev",
  async send(message) {
    try {
      console.info(`[majiflow:sms] to=${message.to} body=${message.body}`);
    } catch {
      /* logging must never throw */
    }
    const code = message.body.match(/\b(\d{6})\b/)?.[1];
    return {
      sent: true,
      provider: "dev",
      ...(devEchoEnabled() && code ? { devCode: code } : {}),
    };
  },
};

/** Africa's Talking: username + api key, sender id optional. */
export const africaTalkingSmsSender: SmsSender = {
  name: "africastalking",
  async send(message) {
    const username = baseEnv("MF_SMS_AT_USERNAME");
    const apiKey = baseEnv("MF_SMS_AT_API_KEY");
    if (!username || !apiKey) {
      return { sent: false, provider: "africastalking", error: "Missing Africa's Talking credentials." };
    }
    const form = new URLSearchParams({ to: message.to, message: message.body });
    const from = baseEnv("MF_SMS_SENDER");
    if (from) form.set("from", from);
    try {
      const response = await postForm(
        "https://api.africastalking.com/version1/messaging",
        form,
        { authorization: `Basic ${Buffer.from(`${username}:${apiKey}`).toString("base64")}` }
      );
      if (!response.ok) {
        return { sent: false, provider: "africastalking", error: `Provider responded ${response.status}.` };
      }
      const payload = (await response.json().catch(() => null)) as
        | { SMSMessageRecipients?: { recipientId?: string }[] }
        | null;
      return {
        sent: true,
        provider: "africastalking",
        providerId: payload?.SMSMessageRecipients?.[0]?.recipientId,
      };
    } catch (error) {
      return {
        sent: false,
        provider: "africastalking",
        error: error instanceof Error ? error.message : "unknown",
      };
    }
  },
};

/** Any HTTP provider MajiFlow does not know about yet. */
export function webhookSmsSender(url: string): SmsSender {
  return {
    name: "webhook",
    async send(message) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ to: message.to, message: message.body, purpose: message.purpose ?? "otp" }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) {
          return { sent: false, provider: "webhook", error: `Provider responded ${response.status}.` };
        }
        return { sent: true, provider: "webhook" };
      } catch (error) {
        return {
          sent: false,
          provider: "webhook",
          error: error instanceof Error ? error.message : "unknown",
        };
      }
    },
  };
}

/** Twilio's messaging API. */
export const twilioSmsSender: SmsSender = {
  name: "twilio",
  async send(message) {
    const accountSid = baseEnv("MF_SMS_TWILIO_ACCOUNT_SID");
    const authToken = baseEnv("MF_SMS_TWILIO_AUTH_TOKEN");
    const from = baseEnv("MF_SMS_TWILIO_FROM") || baseEnv("MF_SMS_SENDER");
    if (!accountSid || !authToken || !from) {
      return { sent: false, provider: "twilio", error: "Missing Twilio credentials." };
    }
    const form = new URLSearchParams({ To: message.to, Body: message.body, From: from });
    try {
      const response = await postForm(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        form,
        { authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}` }
      );
      if (!response.ok) {
        return { sent: false, provider: "twilio", error: `Provider responded ${response.status}.` };
      }
      const payload = (await response.json().catch(() => null)) as { sid?: string } | null;
      return { sent: true, provider: "twilio", providerId: payload?.sid };
    } catch (error) {
      return { sent: false, provider: "twilio", error: error instanceof Error ? error.message : "unknown" };
    }
  },
};

/** The provider this deployment should use. */
export function resolveSmsSender(): SmsSender {
  const explicit = baseEnv("MF_SMS_PROVIDER").toLowerCase();
  if (explicit === "dev") return devSmsSender;
  if (explicit === "africastalking") return africaTalkingSmsSender;
  if (explicit === "twilio") return twilioSmsSender;
  if (explicit === "webhook") {
    const url = baseEnv("MF_SMS_WEBHOOK_URL") || baseEnv("MF_NOTIFY_WEBHOOK_URL");
    if (url) return webhookSmsSender(url);
  }

  if (baseEnv("MF_SMS_AT_USERNAME") && baseEnv("MF_SMS_AT_API_KEY")) return africaTalkingSmsSender;
  const webhookUrl = baseEnv("MF_SMS_WEBHOOK_URL") || baseEnv("MF_NOTIFY_WEBHOOK_URL");
  if (webhookUrl) return webhookSmsSender(webhookUrl);
  if (baseEnv("MF_SMS_TWILIO_ACCOUNT_SID") && baseEnv("MF_SMS_TWILIO_AUTH_TOKEN")) return twilioSmsSender;
  return devSmsSender;
}

/**
 * Send a text. Returns the provider's answer instead of throwing, so callers
 * can decide whether a failed text should block the flow.
 */
export async function sendSms(message: SmsMessage): Promise<SmsSendResult> {
  const sender = resolveSmsSender();
  try {
    const result = await sender.send(message);
    if (!result.sent) {
      await reportFailure("notification", "SMS provider did not accept the message.", {
        provider: result.provider,
        purpose: message.purpose ?? "otp",
        reason: result.error ?? "unknown",
      });
    }
    return result;
  } catch (error) {
    await reportFailure("notification", "SMS provider call failed.", {
      provider: sender.name,
      purpose: message.purpose ?? "otp",
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { sent: false, provider: sender.name, error: "Provider call failed." };
  }
}
