import { fileURLToPath } from "node:url";
import { PROXY_BASE_PATH } from "@weather-widget/proxy";
import { PROXY_DEV_ORIGIN } from "@weather-widget/proxy/dev-server";
import { LOCATION_PICKER_MODULE_PATH } from "@weather-widget/location-picker/build-output";
import { WIDGET_MODULE_PATH } from "@weather-widget/widget/build-output";
import { defineConfig, type Plugin } from "vite";

const VANILLA_HOST_BASE = "/vanilla/";
const VANILLA_HOST_DEV_PORT = 5173;
const sourceOf = (entryPoint: string) =>
  fileURLToPath(import.meta.resolve(entryPoint));
const STANDALONE_MODULE_SOURCES = new Map([
  [WIDGET_MODULE_PATH, sourceOf("@weather-widget/widget")],
  [LOCATION_PICKER_MODULE_PATH, sourceOf("@weather-widget/location-picker")],
]);

const serveStandaloneModulesFromSource = (): Plugin => ({
  name: "serve-standalone-modules-from-source",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      const source = STANDALONE_MODULE_SOURCES.get(request.url ?? "");
      if (source !== undefined) {
        request.url = `${VANILLA_HOST_BASE}@fs${source}`;
      }
      next();
    });
  },
});

export default defineConfig({
  base: VANILLA_HOST_BASE,
  plugins: [serveStandaloneModulesFromSource()],
  build: {
    outDir: `../../dist${VANILLA_HOST_BASE}`,
    emptyOutDir: true,
  },
  server: {
    port: VANILLA_HOST_DEV_PORT,
    strictPort: true,
    proxy: {
      [PROXY_BASE_PATH]: PROXY_DEV_ORIGIN,
    },
  },
});
