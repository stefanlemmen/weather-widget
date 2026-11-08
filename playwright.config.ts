import { defineConfig, devices } from "@playwright/test";
import { PREVIEW_ORIGIN } from "./scripts/preview-server.ts";

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI
    ? [["github"], ["./scripts/playwright-summary-reporter.ts"]]
    : "list",
  use: { baseURL: PREVIEW_ORIGIN },
  projects: [{ name: "chromium", use: devices["Desktop Chrome"] }],
  webServer: {
    command: "pnpm preview",
    url: `${PREVIEW_ORIGIN}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { WEATHER_PROVIDER_MODE: "fixtures" },
  },
});
