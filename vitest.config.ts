import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/studio/src", import.meta.url)) } },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    setupFiles: ["tests/setup/networkGuard.ts"],
  },
});
