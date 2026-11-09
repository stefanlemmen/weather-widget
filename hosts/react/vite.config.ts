import { PROXY_BASE_PATH } from "@weather-widget/proxy";
import { PROXY_DEV_ORIGIN } from "@weather-widget/proxy/dev-server";
import { defineConfig } from "vite";

const REACT_HOST_BASE = "/react/";

export default defineConfig({
  base: REACT_HOST_BASE,
  build: {
    outDir: `../../dist${REACT_HOST_BASE}`,
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        minify: true,
        comments: { legal: true, annotation: false, jsdoc: false },
      },
    },
  },
  server: {
    proxy: {
      [PROXY_BASE_PATH]: PROXY_DEV_ORIGIN,
    },
  },
});
