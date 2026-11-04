/** Runs once per server instance before it takes requests. */
export async function register() {
  // NEXT_RUNTIME is inlined at build time, so the Edge bundle drops this
  // branch and never pulls in the Node-only module.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
