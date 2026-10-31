import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // The order store writes to a temp data dir in tests (see orders-file.ts).
    pool: "threads",
    // The *.postgres.test.ts files share one throwaway database and empty its
    // tables between tests, so they must not run side by side.
    fileParallelism: !process.env.MF_TEST_DATABASE_URL,
  },
});
