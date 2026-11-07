import type { HealthResponse } from "@weather-widget/forecast-contract";
import { Hono } from "hono";
import { parseEnvironment, type RawEnvironment } from "./environment.ts";

export const PROXY_BASE_PATH = "/api";

export const createProxy = (rawEnvironment: RawEnvironment): Hono => {
  parseEnvironment(rawEnvironment);

  return new Hono()
    .basePath(PROXY_BASE_PATH)
    .get("/health", (context) =>
      context.json({ status: "ok" } satisfies HealthResponse),
    );
};
