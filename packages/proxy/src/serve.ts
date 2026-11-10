import { serve } from "@hono/node-server";
import { PROXY_DEV_PORT } from "@weather-widget/contract/dev-server";
import { createLocalProxy } from "./local-proxy.ts";

const proxy = createLocalProxy(process.env);

serve({ fetch: proxy.fetch, port: PROXY_DEV_PORT }, ({ port }) => {
  console.log(`Proxy listening on http://localhost:${String(port)}`);
});
