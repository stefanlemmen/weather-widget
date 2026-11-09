import { readFileSync } from "node:fs";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { vitestCiReporting } from "../../scripts/vitest-summary-reporter.ts";
import {
  LOCATION_PICKER_MODULE_DIRECTORY,
  LOCATION_PICKER_MODULE_FILE,
} from "./src/build-output.ts";

const LUCIDE_LICENSE = readFileSync(
  new URL("lucide-LICENSE", import.meta.url),
  "utf8",
);
const LUCIDE_NOTICE = `/*! Lucide (https://lucide.dev)\n\n${LUCIDE_LICENSE}*/`;

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => LOCATION_PICKER_MODULE_FILE,
    },
    outDir: `../../dist/${LOCATION_PICKER_MODULE_DIRECTORY}`,
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        minify: true,
        banner: LUCIDE_NOTICE,
        comments: { legal: true, annotation: false, jsdoc: false },
      },
    },
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
