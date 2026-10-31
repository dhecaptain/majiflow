import { reportFailure } from "@/lib/monitoring";
import { clientIp, limitResponse, LIMITS } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 8000;

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Contact form. Messages go to MF_CONTACT_WEBHOOK_URL (falling back to the
 * alert webhook). Without either, it answers 503 so the page can hand the
 * message to the visitor's email app instead of pretending it was sent.
 */
export async function POST(request: Request) {
  const limited = await limitResponse([{ key: `contact:ip:${clientIp(request)}`, rule: LIMITS.formPerIp }]);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const message = {
    name: text(body.name, 120),
    email: text(body.email, 320),
    phone: text(body.phone, 30),
    topic: text(body.topic, 80),
    message: text(body.message, 4000),
  };
  const fields: Record<string, string> = {};
  if (message.name.length < 2) fields.name = "Tell us your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.email) && message.phone.replace(/\D/g, "").length < 9) {
    fields.email = "Add an email or phone number so we can reply.";
  }
  if (message.message.length < 10) fields.message = "Write a few words about what you need.";
  if (Object.keys(fields).length) return Response.json({ error: "Please fix the highlighted fields.", fields }, { status: 422 });

  const url = process.env.MF_CONTACT_WEBHOOK_URL?.trim() || process.env.MF_ALERT_WEBHOOK_URL?.trim();
  if (!url) return Response.json({ error: "Messages cannot be sent from the site right now." }, { status: 503 });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "contact", ...message, at: new Date().toISOString() }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`webhook answered ${response.status}`);
    return Response.json({ ok: true });
  } catch (error) {
    await reportFailure("notification", "Could not deliver a contact message.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    return Response.json({ error: "Messages cannot be sent from the site right now." }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
