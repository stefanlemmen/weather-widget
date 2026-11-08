import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { vitestCiReporting } from "../../scripts/vitest-summary-reporter.ts";
import {
  WIDGET_MODULE_DIRECTORY,
  WIDGET_MODULE_FILE,
} from "./src/build-output.ts";
import { emulateMedia } from "./test/emulate-media-command.ts";

const METEOCONS_LICENSE = readFileSync(
  fileURLToPath(import.meta.resolve("@meteocons/svg/LICENSE")),
  "utf8",
);
const METEOCONS_NOTICE = `/*! Meteocons (https://github.com/basmilius/meteocons)\n\n${METEOCONS_LICENSE}*/`;

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => WIDGET_MODULE_FILE,
    },
    outDir: `../../dist/${WIDGET_MODULE_DIRECTORY}`,
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        minify: true,
        banner: METEOCONS_NOTICE,
        comments: { legal: true, annotation: false, jsdoc: false },
      },
    },
  },
  optimizeDeps: {
    include: ["lit", "valibot"],
  },
  test: {
    ...vitestCiReporting("Widget"),
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
      commands: { emulateMedia },
    },
  },
});
