import { defineConfig } from "vitest/config";
import { vitestCiReporting } from "./scripts/vitest-summary-reporter.ts";

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts", "e2e/**/*.test.ts"],
    ...vitestCiReporting("CI script"),
  },
});
