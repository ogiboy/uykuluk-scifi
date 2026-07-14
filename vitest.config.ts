import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/studio/src", import.meta.url)) } },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    maxWorkers: 4,
    pool: "forks",
    setupFiles: ["tests/setup/networkGuard.ts"],
    ...(process.env.CI ? { hookTimeout: 15_000, maxWorkers: 2, testTimeout: 15_000 } : {}),
  },
});
