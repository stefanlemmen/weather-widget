import { defineConfig } from "vitest/config";
import { vitestCiReporting } from "../../scripts/vitest-summary-reporter.ts";
import { VERCEL_FUNCTION_BUNDLE } from "./src/build-output.ts";

export default defineConfig({
  build: {
    ssr: "src/vercel.ts",
    outDir: "dist",
    emptyOutDir: true,
    rolldownOptions: {
      output: { entryFileNames: VERCEL_FUNCTION_BUNDLE },
    },
  },
  ssr: { noExternal: true },
  test: {
    ...vitestCiReporting("Proxy"),
  },
});
