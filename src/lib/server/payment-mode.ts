/**
 * Which payment rails this deployment offers. Kept apart from payments.ts so
 * the order store can ask without importing the payment lifecycle.
 */

export type ProviderName = "daraja" | "dev";

/** Which provider to use. Daraja only when credentials are configured. */
export function providerMode(): ProviderName {
  if (process.env.MF_PAYMENTS_MODE === "daraja" || process.env.MF_PAYMENTS_MODE === "dev") {
    return process.env.MF_PAYMENTS_MODE;
  }
  return process.env.DARAJA_CONSUMER_KEY && process.env.DARAJA_CONSUMER_SECRET ? "daraja" : "dev";
}

/** Dev/test callbacks are only honored outside production. */
export function devCallbacksAllowed(): boolean {
  return providerMode() === "dev" && process.env.NODE_ENV !== "production";
}

/**
 * Whether checkout may offer M-Pesa up front. In production that needs a real
 * provider: the dev provider never confirms anything, so an order paid that
 * way would wait forever. Pay on delivery is always available.
 */
export function onlinePaymentAvailable(): boolean {
  return providerMode() === "daraja" || process.env.NODE_ENV !== "production";
}
