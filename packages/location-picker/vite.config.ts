import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { MINIFIED_BUILD_OUTPUT } from "../../scripts/minified-build-output.ts";
import { vitestCiReporting } from "../../scripts/vitest-summary-reporter.ts";
import {
  LOCATION_PICKER_MODULE_DIRECTORY,
  LOCATION_PICKER_MODULE_FILE,
} from "./src/build-output.ts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => LOCATION_PICKER_MODULE_FILE,
    },
    outDir: `../../dist/${LOCATION_PICKER_MODULE_DIRECTORY}`,
    emptyOutDir: true,
    rolldownOptions: { output: MINIFIED_BUILD_OUTPUT },
  },
  optimizeDeps: {
    include: ["lit", "valibot"],
  },
  test: {
    ...vitestCiReporting("Location picker"),
    setupFiles: ["test/support.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
