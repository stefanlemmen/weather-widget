import type { Hono } from "hono";
import * as v from "valibot";
import { recordedFetch } from "../fixtures/recorded-responses.ts";
import type { RawEnvironment } from "./environment.ts";
import { createProxy } from "./proxy.ts";

const PROVIDER_MODES = {
  live: "live",
  fixtures: "fixtures",
} as const;

const UNKNOWN_PROVIDER_MODE_MESSAGE = `PROVIDER_MODE must be "${PROVIDER_MODES.live}" or "${PROVIDER_MODES.fixtures}".`;

const RECORDED_ENVIRONMENT = { OPENWEATHER_API_KEY: "recorded" };

const ProviderModeSchema = v.object({
  PROVIDER_MODE: v.optional(
    v.picklist(Object.values(PROVIDER_MODES), UNKNOWN_PROVIDER_MODE_MESSAGE),
    PROVIDER_MODES.live,
  ),
});

export const createLocalProxy = (rawEnvironment: RawEnvironment): Hono =>
  v.parse(ProviderModeSchema, rawEnvironment).PROVIDER_MODE ===
  PROVIDER_MODES.fixtures
    ? createProxy(RECORDED_ENVIRONMENT, { fetch: recordedFetch })
    : createProxy(rawEnvironment);
