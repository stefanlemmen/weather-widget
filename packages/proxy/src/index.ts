import {
  FORECAST_PATH,
  ForecastQuerySchema,
  LATITUDE_RANGE,
  LONGITUDE_RANGE,
  PROBLEM_DETAILS_MEDIA_TYPE,
  PROXY_BASE_PATH,
  UNTYPED_PROBLEM,
  type ForecastResponse,
  type HealthResponse,
  type ProblemDetails,
} from "@weather-widget/contract";
import { Hono, type Context } from "hono";
import * as v from "valibot";
import {
  parseEnvironment,
  WEATHER_PROVIDER_MODES,
  type RawEnvironment,
} from "./environment.ts";
import {
  createLiveWeatherProvider,
  fixtureFetch,
  WEATHER_PROVIDER_TIMEOUT_MS,
} from "./weather-provider.ts";

export { PROXY_BASE_PATH };

export const FORECAST_CACHE_CONTROL =
  "public, max-age=0, s-maxage=600, stale-while-revalidate=600, stale-if-error=3600";
const NO_STORE = "no-store";
const FIXTURE_KEY = "fixtures";
const COORDINATE_DECIMALS = 2;

export interface ProxyDependencies {
  readonly fetch: typeof globalThis.fetch;
  readonly weatherProviderTimeoutMs?: number;
}

const roundCoordinate = (value: number) => {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
};

const problem = (
  context: Context,
  details: ProblemDetails & { status: 400 | 404 | 503 },
) => {
  context.header("cache-control", NO_STORE);
  return context.body(JSON.stringify(details), details.status, {
    "content-type": PROBLEM_DETAILS_MEDIA_TYPE,
  });
};

export const createProxy = (
  rawEnvironment: RawEnvironment,
  dependencies: ProxyDependencies = { fetch: globalThis.fetch },
): Hono => {
  const environment = parseEnvironment(rawEnvironment);
  const fetchForecast = createLiveWeatherProvider(
    environment.mode === WEATHER_PROVIDER_MODES.fixtures
      ? {
          key: FIXTURE_KEY,
          fetch: fixtureFetch,
          timeoutMs: WEATHER_PROVIDER_TIMEOUT_MS,
        }
      : {
          key: environment.weatherProviderKey,
          fetch: dependencies.fetch,
          timeoutMs:
            dependencies.weatherProviderTimeoutMs ??
            WEATHER_PROVIDER_TIMEOUT_MS,
        },
  );

  const proxy = new Hono().basePath(PROXY_BASE_PATH);
  proxy.notFound((context) =>
    problem(context, {
      type: UNTYPED_PROBLEM,
      title: "Not found",
      status: 404,
    }),
  );

  return proxy
    .get("/health", (context) =>
      context.json({ status: "ok" } satisfies HealthResponse),
    )
    .get(FORECAST_PATH, async (context) => {
      const query = v.safeParse(ForecastQuerySchema, context.req.query());
      if (!query.success) {
        return problem(context, {
          type: UNTYPED_PROBLEM,
          title: "Invalid forecast request",
          status: 400,
          detail: `latitude must be a number from ${String(LATITUDE_RANGE.min)} to ${String(LATITUDE_RANGE.max)} and longitude a number from ${String(LONGITUDE_RANGE.min)} to ${String(LONGITUDE_RANGE.max)}.`,
        });
      }

      const forecast = await fetchForecast({
        latitude: roundCoordinate(query.output.latitude),
        longitude: roundCoordinate(query.output.longitude),
      });
      if (forecast.status === "error") {
        return problem(context, {
          type: UNTYPED_PROBLEM,
          title: "Forecast unavailable",
          status: 503,
          detail: "The Weather provider could not be reached. Try again later.",
        });
      }

      context.header("cache-control", FORECAST_CACHE_CONTROL);
      return context.json({
        location: forecast.data.location,
        parts: { current: { status: "ok", data: forecast.data.current } },
      } satisfies ForecastResponse);
    });
};
