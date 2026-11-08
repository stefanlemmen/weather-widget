import {
  FoundLocationSchema,
  MAX_LOCATIONS_FOUND,
  type LocationsQuery,
  type LocationsResponse,
  type Result,
} from "@weather-widget/contract";
import * as v from "valibot";
import { RECORDED_SEARCHES } from "../fixtures/recorded-responses.ts";
import { WEATHER_PROVIDER_MODES, type Environment } from "./environment.ts";
import { fetchParsedWith, type ProviderCall } from "./provider-call.ts";

const SEARCH_PROVIDER = "Search provider";
const SEARCH_PROVIDER_TIMEOUT_MS = 3000;
const JSON_FORMAT = "json";

const OptionalPlaceNameSchema = v.pipe(
  v.optional(v.string(), ""),
  v.trim(),
  v.transform((name) => (name === "" ? null : name)),
);

const ResultSchema = v.pipe(
  v.object({
    name: v.pipe(v.string(), v.trim()),
    admin1: OptionalPlaceNameSchema,
    country: OptionalPlaceNameSchema,
    latitude: v.number(),
    longitude: v.number(),
  }),
  v.transform(({ name, admin1, country, latitude, longitude }) => ({
    name,
    region: admin1,
    country,
    latitude,
    longitude,
  })),
  FoundLocationSchema,
);

const SearchResponseSchema = v.pipe(
  v.object({ results: v.optional(v.array(ResultSchema), []) }),
  v.transform(({ results }) => ({
    locations: results.slice(0, MAX_LOCATIONS_FOUND),
  })),
);

const SEARCH_CALL = {
  name: "search",
  url: "https://geocoding-api.open-meteo.com/v1/search",
  schema: SearchResponseSchema,
} satisfies ProviderCall<v.GenericSchema>;

export type FindLocations = (
  query: LocationsQuery,
) => Promise<Result<LocationsResponse>>;

export interface SearchProviderDependencies {
  readonly fetch: typeof globalThis.fetch;
  readonly searchProviderTimeoutMs?: number;
}

const RECORDED_SEARCHES_BY_TERM = new Map<string, unknown>([
  ["paris", RECORDED_SEARCHES.paris],
  ["parijs", RECORDED_SEARCHES.parijs],
]);

const recordedSearch: typeof globalThis.fetch = (input) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const term = url.searchParams.get("name")?.toLocaleLowerCase() ?? "";
  return Promise.resolve(
    Response.json(
      RECORDED_SEARCHES_BY_TERM.get(term) ?? RECORDED_SEARCHES.noResults,
    ),
  );
};

export const createSearchProvider = (
  environment: Environment,
  dependencies: SearchProviderDependencies,
): FindLocations => {
  const fetchParsed = fetchParsedWith({
    provider: SEARCH_PROVIDER,
    fetch:
      environment.mode === WEATHER_PROVIDER_MODES.fixtures
        ? recordedSearch
        : dependencies.fetch,
    timeoutMs:
      dependencies.searchProviderTimeoutMs ?? SEARCH_PROVIDER_TIMEOUT_MS,
  });

  return ({ name, locale }) =>
    fetchParsed(SEARCH_CALL, {
      name,
      count: String(MAX_LOCATIONS_FOUND),
      language: locale,
      format: JSON_FORMAT,
    });
};
