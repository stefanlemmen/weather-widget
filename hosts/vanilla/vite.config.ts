import { PROXY_BASE_PATH } from "@weather-widget/proxy";
import { PROXY_DEV_ORIGIN } from "@weather-widget/proxy/dev-server";
import { defineConfig } from "vite";

const VANILLA_HOST_BASE = "/vanilla/";

export default defineConfig({
  base: VANILLA_HOST_BASE,
  build: {
    outDir: `../../dist${VANILLA_HOST_BASE}`,
    emptyOutDir: true,
  },
  server: {
    proxy: {
      [PROXY_BASE_PATH]: PROXY_DEV_ORIGIN,
    },
  },
});
