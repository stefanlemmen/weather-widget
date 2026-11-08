import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { vitestCiReporting } from "../../scripts/vitest-summary-reporter.ts";
import {
  LOCATION_PICKER_BUILD_MODE,
  LOCATION_PICKER_MODULE_FILE,
  WIDGET_MODULE_DIRECTORY,
  WIDGET_MODULE_FILE,
} from "./src/build-output.ts";
import { emulateMedia } from "./test/emulate-media-command.ts";

const METEOCONS_LICENSE = readFileSync(
  fileURLToPath(import.meta.resolve("@meteocons/svg/LICENSE")),
  "utf8",
);
const METEOCONS_NOTICE = `/*! Meteocons (https://github.com/basmilius/meteocons)\n\n${METEOCONS_LICENSE}*/`;
const LUCIDE_LICENSE = readFileSync(
  new URL("src/icons/lucide-LICENSE", import.meta.url),
  "utf8",
);
const LUCIDE_NOTICE = `/*! Lucide (https://lucide.dev)\n\n${LUCIDE_LICENSE}*/`;

const STANDALONE_MODULES = {
  widget: {
    entry: "src/index.ts",
    file: WIDGET_MODULE_FILE,
    notice: METEOCONS_NOTICE,
    emptyOutDir: true,
  },
  locationPicker: {
    entry: "src/location-picker.ts",
    file: LOCATION_PICKER_MODULE_FILE,
    notice: LUCIDE_NOTICE,
    emptyOutDir: false,
  },
} as const;

export default defineConfig(({ mode }) => {
  const standalone =
    mode === LOCATION_PICKER_BUILD_MODE
      ? STANDALONE_MODULES.locationPicker
      : STANDALONE_MODULES.widget;
  return {
    build: {
      lib: {
        entry: standalone.entry,
        formats: ["es"],
        fileName: () => standalone.file,
      },
      outDir: `../../dist/${WIDGET_MODULE_DIRECTORY}`,
      emptyOutDir: standalone.emptyOutDir,
      rolldownOptions: {
        output: {
          minify: true,
          banner: standalone.notice,
          comments: { legal: true, annotation: false, jsdoc: false },
        },
      },
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
  };
});
