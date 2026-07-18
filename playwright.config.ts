import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: { baseURL: "http://127.0.0.1:3000", trace: "on-first-retry" },
  webServer: {
    command: "pnpm studio:build && pnpm studio:start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /webkit-main-path\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      testMatch: /webkit-main-path\.spec\.ts/,
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
