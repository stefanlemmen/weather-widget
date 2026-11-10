import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { BROWSER_BUILD_TARGET } from "../../scripts/browser-build-target.ts";
import { MINIFIED_BUILD_OUTPUT } from "../../scripts/minified-build-output.ts";
import { vitestCiReporting } from "../../scripts/vitest-summary-reporter.ts";
import {
  WIDGET_MODULE_DIRECTORY,
  WIDGET_MODULE_FILE,
} from "./src/build-output.ts";
import { emulateMedia } from "./test/emulate-media-command.ts";

export default defineConfig({
  build: {
    target: BROWSER_BUILD_TARGET,
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => WIDGET_MODULE_FILE,
    },
    outDir: `../../dist/${WIDGET_MODULE_DIRECTORY}`,
    emptyOutDir: true,
    rolldownOptions: { output: MINIFIED_BUILD_OUTPUT },
  },
  optimizeDeps: {
    include: ["lit", "valibot"],
  },
  test: {
    ...vitestCiReporting("Widget"),
    setupFiles: ["test/support.ts"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
      commands: { emulateMedia },
    },
  },
});
