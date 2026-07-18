import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/studio/src", import.meta.url)) } },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    hookTimeout: 15_000,
    maxWorkers: 2,
    pool: "forks",
    setupFiles: ["tests/setup/networkGuard.ts"],
    testTimeout: 15_000,
  },
});
