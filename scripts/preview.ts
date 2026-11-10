import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createLocalProxy } from "@weather-widget/proxy/local-proxy";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { PREVIEW_PORT } from "./preview-server.ts";

const STATIC_OUTPUT_ROOT = ".vercel/output/static";

const preview = new Hono()
  .use(compress())
  .route("/", createLocalProxy(process.env))
  .use("/*", serveStatic({ root: STATIC_OUTPUT_ROOT }));

serve({ fetch: preview.fetch, port: PREVIEW_PORT }, ({ port }) => {
  console.log(`Preview listening on http://localhost:${String(port)}`);
});
