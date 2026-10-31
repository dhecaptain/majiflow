/** Runs once per server instance before it takes requests. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const { productionEnvProblems } = await import("@/lib/server/env-check");
  const problems = productionEnvProblems();
  if (problems.length === 0) return;
  const lines = problems.map((p) => `  ${p.severity === "error" ? "✗" : "!"} ${p.name}: ${p.why}`);
  console.error(`[majiflow:config] Production configuration needs attention:\n${lines.join("\n")}`);
}
