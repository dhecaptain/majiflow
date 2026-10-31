/** Constants shared by the console's server loaders and its client screens. */

export const INSIGHT_RANGES = [7, 30, 90] as const;
export type InsightRange = (typeof INSIGHT_RANGES)[number];

export function parseInsightRange(value: unknown): InsightRange {
  const days = Number(value);
  return (INSIGHT_RANGES as readonly number[]).includes(days) ? (days as InsightRange) : 30;
}

export type StationState = "suspended" | "live" | "hidden" | "ready" | "setup";

export const STATION_STATES: readonly StationState[] = ["live", "hidden", "ready", "setup", "suspended"];

export const STATION_STATE_LABEL: Record<StationState, string> = {
  live: "Live",
  hidden: "Published, not visible",
  ready: "Ready to publish",
  setup: "Setting up",
  suspended: "Suspended",
};

export type AdminUserRole = "customer" | "business_owner" | "operations";

export const ROLE_LABEL: Record<AdminUserRole, string> = {
  customer: "Customer",
  business_owner: "Station owner",
  operations: "Operations",
};
