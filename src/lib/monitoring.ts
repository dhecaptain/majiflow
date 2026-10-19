/**
 * Failure reporting for the order pipeline.
 *
 * There is no logging service wired up yet, so this module is the single seam
 * where an alert would leave the app. Without configuration it writes a
 * structured line to stderr, which is what a platform log drain picks up. With
 * `MF_ALERT_WEBHOOK_URL` set it also POSTs the alert, so payment, order and
 * notification failures can page someone.
 *
 * Reporting must never take a request down with it: every path here swallows
 * its own errors.
 */

export type AlertKind = "order" | "payment" | "notification" | "store" | "geocode";

export interface Alert {
  kind: AlertKind;
  message: string;
  detail?: Record<string, unknown>;
  at: string;
}

const ALERT_TIMEOUT_MS = 4000;

/** Details that must never reach a log sink. */
const REDACTED_KEYS = new Set(["customerPhone", "phone", "email", "address", "token", "authorization"]);

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strip);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key) ? "[redacted]" : strip(entry);
    }
    return out;
  }
  return value;
}

export function buildAlert(kind: AlertKind, message: string, detail?: Record<string, unknown>, now = new Date()): Alert {
  return {
    kind,
    message,
    detail: detail ? (strip(detail) as Record<string, unknown>) : undefined,
    at: now.toISOString(),
  };
}

async function postToWebhook(alert: Alert): Promise<void> {
  const url = process.env.MF_ALERT_WEBHOOK_URL;
  if (!url) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(alert),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Record a failure. Never throws, never blocks the caller for long. */
export async function reportFailure(
  kind: AlertKind,
  message: string,
  detail?: Record<string, unknown>
): Promise<void> {
  const alert = buildAlert(kind, message, detail);
  try {
    console.error(`[majiflow:${kind}] ${JSON.stringify(alert)}`);
  } catch {
    /* logging must never throw */
  }
  try {
    await postToWebhook(alert);
  } catch (error) {
    try {
      console.error(
        `[majiflow:notification] alert webhook failed: ${error instanceof Error ? error.message : "unknown"}`
      );
    } catch {
      /* noop */
    }
  }
}

let warnedNoNotificationProvider = false;

/**
 * Tell a customer their order moved. When no notification provider is
 * configured, this reports the gap once and then stays quiet rather than
 * failing on every status change.
 */
export async function notifyStatusChange(
  order: { id: string; status: string; orderNumber?: string },
  to: string,
  message?: string
): Promise<{ sent: boolean }> {
  const url = process.env.MF_NOTIFY_WEBHOOK_URL;
  if (!url) {
    if (!warnedNoNotificationProvider) {
      warnedNoNotificationProvider = true;
      await reportFailure("notification", "No notification provider is configured; status messages are not sent.", {
        provider: null,
      });
    }
    return { sent: false };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // The sending provider receives the number; the alert log never does.
      body: JSON.stringify({
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        to,
        ...(message ? { message } : {}),
      }),
    });
    if (!response.ok) {
      await reportFailure("notification", `Notification provider rejected a status message (${response.status}).`, {
        orderId: order.id,
        status: order.status,
      });
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    await reportFailure("notification", "Notification provider request failed.", {
      orderId: order.id,
      status: order.status,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { sent: false };
  }
}
