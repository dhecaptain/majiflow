/**
 * Production configuration check, run once when a server instance starts (see
 * src/instrumentation.ts). It reports everything missing in one go, so a bad
 * deploy is obvious from the first log line instead of from the first failed
 * order. It never stops the server: pages that need nothing missing still work.
 */

export interface EnvProblem {
  name: string;
  why: string;
  severity: "error" | "warning";
}

const has = (name: string) => Boolean(process.env[name]?.trim());

export function productionEnvProblems(): EnvProblem[] {
  const problems: EnvProblem[] = [];
  const need = (name: string, why: string, severity: EnvProblem["severity"] = "error") => {
    if (!has(name)) problems.push({ name, why, severity });
  };

  need("DATABASE_URL", "orders, payments, stations and accounts are stored in Postgres");
  need("MF_OTP_SECRET", "phone sign-in codes cannot be issued without it");
  need("MF_ADMIN_KEY", "the /admin console and admin APIs stay locked without it");
  need("CRON_SECRET", "the daily retention sweep is refused without it");
  need("MF_ALERT_WEBHOOK_URL", "failures are only written to the server log", "warning");

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  if (!site || /localhost|127\.0\.0\.1/.test(site)) {
    problems.push({
      name: "NEXT_PUBLIC_SITE_URL",
      why: "canonical URLs, the sitemap and share previews point at localhost (set it at build time)",
      severity: "error",
    });
  }

  const sms =
    (has("MF_SMS_AT_USERNAME") && has("MF_SMS_AT_API_KEY")) ||
    (has("MF_SMS_TWILIO_ACCOUNT_SID") && has("MF_SMS_TWILIO_AUTH_TOKEN")) ||
    has("MF_SMS_WEBHOOK_URL");
  if (!sms) {
    problems.push({
      name: "MF_SMS_AT_USERNAME / MF_SMS_TWILIO_* / MF_SMS_WEBHOOK_URL",
      why: "no SMS provider: sign-in codes and order updates cannot be sent",
      severity: "error",
    });
  }

  const daraja = process.env.MF_PAYMENTS_MODE === "daraja" || (has("DARAJA_CONSUMER_KEY") && has("DARAJA_CONSUMER_SECRET"));
  if (daraja) {
    for (const name of ["DARAJA_SHORTCODE", "DARAJA_PASSKEY", "DARAJA_CALLBACK_URL", "MF_PAYMENTS_CALLBACK_TOKEN"]) {
      need(name, "M-Pesa checkout is enabled but cannot complete payments without it");
    }
    if (process.env.DARAJA_ENV !== "production") {
      problems.push({ name: "DARAJA_ENV", why: "M-Pesa is still pointed at the Safaricom sandbox", severity: "warning" });
    }
  }

  if (process.env.MF_DEMO_STATIONS === "1") {
    problems.push({ name: "MF_DEMO_STATIONS", why: "sample stations are listed and can take orders", severity: "warning" });
  }
  if (has("MF_DATA_DIR")) {
    problems.push({ name: "MF_DATA_DIR", why: "orders and payments would be written to local files, not Postgres", severity: "error" });
  }
  return problems;
}
