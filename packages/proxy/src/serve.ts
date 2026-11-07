import { serve } from "@hono/node-server";
import { PROXY_DEV_PORT } from "./dev-server.ts";
import { createProxy } from "./index.ts";

const proxy = createProxy(process.env);

serve({ fetch: proxy.fetch, port: PROXY_DEV_PORT }, ({ port }) => {
  console.log(`Proxy listening on http://localhost:${String(port)}`);
});
