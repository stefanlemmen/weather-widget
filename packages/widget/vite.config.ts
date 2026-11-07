import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import {
  WIDGET_MODULE_DIRECTORY,
  WIDGET_MODULE_FILE,
} from "./src/build-output.ts";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => WIDGET_MODULE_FILE,
    },
    outDir: `../../dist/${WIDGET_MODULE_DIRECTORY}`,
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: ["lit", "valibot"],
  },
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
