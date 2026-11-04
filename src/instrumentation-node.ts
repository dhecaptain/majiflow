import { setDefaultAutoSelectFamilyAttemptTimeout } from "node:net";

/**
 * Node.js-only server setup, loaded from `instrumentation.ts` so the Edge
 * bundle never sees `node:*` imports.
 */
export async function registerNode() {
  // Node's "happy eyeballs" connect gives each resolved address only 250 ms by
  // default. On high-latency links (e.g. Kenya to EU/US hosts, ~350 ms) every
  // attempt times out and outbound fetches fail with ETIMEDOUT, even though the
  // host is reachable. Nominatim alone resolves to 8 addresses.
  setDefaultAutoSelectFamilyAttemptTimeout(2500);

  if (process.env.NODE_ENV !== "production") return;
  const { productionEnvProblems } = await import("@/lib/server/env-check");
  const problems = productionEnvProblems();
  if (problems.length === 0) return;
  const lines = problems.map((p) => `  ${p.severity === "error" ? "✗" : "!"} ${p.name}: ${p.why}`);
  console.error(`[majiflow:config] Production configuration needs attention:\n${lines.join("\n")}`);
}
