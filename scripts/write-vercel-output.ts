import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { VERCEL_FUNCTION_BUNDLE } from "@weather-widget/proxy/build-output";
import { PROXY_BASE_PATH } from "@weather-widget/proxy";

const workspaceRoot = new URL("../", import.meta.url);
const outputDirectory = new URL(".vercel/output/", workspaceRoot);
const staticDirectory = new URL("static/", outputDirectory);
const proxyFunctionDirectory = new URL(
  `functions${PROXY_BASE_PATH}.func/`,
  outputDirectory,
);
const PROXY_FUNCTION_HANDLER = "index.mjs";
const NODE_RUNTIME = "nodejs26.x";

const writeJson = (url: URL, value: unknown) =>
  writeFile(url, `${JSON.stringify(value, null, 2)}\n`);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(proxyFunctionDirectory, { recursive: true });

await cp(new URL("dist/", workspaceRoot), staticDirectory, { recursive: true });
await cp(
  new URL(`packages/proxy/dist/${VERCEL_FUNCTION_BUNDLE}`, workspaceRoot),
  new URL(PROXY_FUNCTION_HANDLER, proxyFunctionDirectory),
);
await writeJson(new URL(".vc-config.json", proxyFunctionDirectory), {
  runtime: NODE_RUNTIME,
  handler: PROXY_FUNCTION_HANDLER,
  launcherType: "Nodejs",
  supportsResponseStreaming: true,
});
await writeJson(new URL("config.json", outputDirectory), {
  version: 3,
  routes: [
    { handle: "filesystem" },
    { src: `${PROXY_BASE_PATH}/(.*)`, dest: PROXY_BASE_PATH },
  ],
});
