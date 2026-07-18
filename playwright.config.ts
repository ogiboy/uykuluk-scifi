import { defineConfig, devices } from "@playwright/test";
import { env } from "node:process";

const prebuiltStudio = env.STUDIO_E2E_PREBUILT === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: env.CI
    ? [
        ["list"],
        ["junit", { outputFile: "test-results/e2e-junit.xml" }],
        ["html", { open: "never", outputFolder: "playwright-report" }],
      ]
    : "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: prebuiltStudio ? "pnpm studio:start" : "pnpm studio:build && pnpm studio:start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !env.CI,
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
