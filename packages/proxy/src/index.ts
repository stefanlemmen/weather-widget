import {
  FORECAST_PARTS,
  FORECAST_PARTS_SEPARATOR,
  FORECAST_PATH,
  ForecastQuerySchema,
  LATITUDE_RANGE,
  LOCALES,
  LOCATIONS_PATH,
  LONGITUDE_RANGE,
  LocationsQuerySchema,
  SEARCH_TERM_MAX_LENGTH,
  PROBLEM_DETAILS_MEDIA_TYPE,
  PROXY_BASE_PATH,
  UNTYPED_PROBLEM,
  type Coordinates,
  type ForecastResponse,
  type HealthResponse,
  type LocationsResponse,
  type ProblemDetails,
} from "@weather-widget/contract";
import { Hono, type Context } from "hono";
import * as v from "valibot";
import { parseEnvironment, type RawEnvironment } from "./environment.ts";
import {
  createSearchProvider,
  type SearchProviderDependencies,
} from "./search-provider.ts";
import {
  createWeatherProvider,
  type WeatherProviderDependencies,
} from "./weather-provider.ts";

export { PROXY_BASE_PATH };

export const FORECAST_CACHE_CONTROL =
  "public, max-age=0, s-maxage=600, stale-while-revalidate=600, stale-if-error=3600";
export const LOCATIONS_CACHE_CONTROL = FORECAST_CACHE_CONTROL;
export const PARTIAL_FORECAST_CACHE_CONTROL =
  "public, max-age=0, s-maxage=60, stale-if-error=3600";
const NO_STORE = "no-store";
const COORDINATE_DECIMALS = 2;

type ProblemResponse = ProblemDetails & { readonly status: 400 | 404 | 503 };

const NOT_FOUND: ProblemResponse = {
  type: UNTYPED_PROBLEM,
  title: "Not found",
  status: 404,
};

const INVALID_FORECAST_REQUEST: ProblemResponse = {
  type: UNTYPED_PROBLEM,
  title: "Invalid forecast request",
  status: 400,
  detail: [
    `latitude must be a number from ${String(LATITUDE_RANGE.min)} to ${String(LATITUDE_RANGE.max)}`,
    `and longitude a number from ${String(LONGITUDE_RANGE.min)} to ${String(LONGITUDE_RANGE.max)}.`,
    `parts, when given, must list Forecast parts from ${FORECAST_PARTS.join(", ")},`,
    `each at most once, in that order and separated by "${FORECAST_PARTS_SEPARATOR}".`,
  ].join(" "),
};

const FORECAST_UNAVAILABLE: ProblemResponse = {
  type: UNTYPED_PROBLEM,
  title: "Forecast unavailable",
  status: 503,
  detail: "The Weather provider could not be reached. Try again later.",
};

const INVALID_LOCATIONS_REQUEST: ProblemResponse = {
  type: UNTYPED_PROBLEM,
  title: "Invalid locations request",
  status: 400,
  detail: [
    `name must be a search term of 1 to ${String(SEARCH_TERM_MAX_LENGTH)} characters`,
    `and locale one of ${LOCALES.join(", ")}.`,
  ].join(" "),
};

const SEARCH_UNAVAILABLE: ProblemResponse = {
  type: UNTYPED_PROBLEM,
  title: "Search unavailable",
  status: 503,
  detail: "The Search provider could not be reached. Try again later.",
};

export type ProxyDependencies = WeatherProviderDependencies &
  SearchProviderDependencies;

const problem = (context: Context, details: ProblemResponse) => {
  context.header("cache-control", NO_STORE);
  return context.body(JSON.stringify(details), details.status, {
    "content-type": PROBLEM_DETAILS_MEDIA_TYPE,
  });
};

const roundCoordinate = (value: number) => {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
};

const roundCoordinates = ({
  latitude,
  longitude,
}: Coordinates): Coordinates => ({
  latitude: roundCoordinate(latitude),
  longitude: roundCoordinate(longitude),
});

const isPartial = ({ parts }: ForecastResponse) =>
  Object.values(parts).some((part) => part?.status === "error");

export const createProxy = (
  rawEnvironment: RawEnvironment,
  dependencies: ProxyDependencies = { fetch: globalThis.fetch },
): Hono => {
  const environment = parseEnvironment(rawEnvironment);
  const fetchForecast = createWeatherProvider(environment, dependencies);
  const findLocations = createSearchProvider(environment, dependencies);

  const proxy = new Hono().basePath(PROXY_BASE_PATH);
  proxy.notFound((context) => problem(context, NOT_FOUND));

  return proxy
    .get("/health", (context) =>
      context.json({ status: "ok" } satisfies HealthResponse),
    )
    .get(FORECAST_PATH, async (context) => {
      const query = v.safeParse(ForecastQuerySchema, context.req.query());
      if (!query.success) return problem(context, INVALID_FORECAST_REQUEST);

      const forecast = await fetchForecast(
        roundCoordinates(query.output),
        query.output.parts,
      );
      if (forecast.status === "error") {
        return problem(context, FORECAST_UNAVAILABLE);
      }

      context.header(
        "cache-control",
        isPartial(forecast.data)
          ? PARTIAL_FORECAST_CACHE_CONTROL
          : FORECAST_CACHE_CONTROL,
      );
      return context.json(forecast.data);
    })
    .get(LOCATIONS_PATH, async (context) => {
      const query = v.safeParse(LocationsQuerySchema, context.req.query());
      if (!query.success) return problem(context, INVALID_LOCATIONS_REQUEST);

      const found = await findLocations(query.output);
      if (found.status === "error") return problem(context, SEARCH_UNAVAILABLE);

      context.header("cache-control", LOCATIONS_CACHE_CONTROL);
      return context.json(found.data satisfies LocationsResponse);
    });
};
