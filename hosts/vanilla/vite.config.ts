import { fileURLToPath } from "node:url";
import { PROXY_BASE_PATH } from "@weather-widget/proxy";
import { PROXY_DEV_ORIGIN } from "@weather-widget/proxy/dev-server";
import { WIDGET_MODULE_PATH } from "@weather-widget/widget/build-output";
import { defineConfig, type Plugin } from "vite";

const VANILLA_HOST_BASE = "/vanilla/";
const WIDGET_SOURCE = fileURLToPath(
  import.meta.resolve("@weather-widget/widget"),
);

const serveWidgetModuleFromSource = (): Plugin => ({
  name: "serve-widget-module-from-source",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === WIDGET_MODULE_PATH) {
        request.url = `${VANILLA_HOST_BASE}@fs${WIDGET_SOURCE}`;
      }
      next();
    });
  },
});

export default defineConfig({
  base: VANILLA_HOST_BASE,
  plugins: [serveWidgetModuleFromSource()],
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
