import {
  FoundLocationSchema,
  MAX_LOCATIONS_FOUND,
  type LocationsQuery,
  type LocationsResponse,
  type Result,
} from "@weather-widget/contract";
import * as v from "valibot";
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

export const SEARCH_CALL = {
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

export const createSearchProvider = (
  dependencies: SearchProviderDependencies,
): FindLocations => {
  const fetchParsed = fetchParsedWith({
    provider: SEARCH_PROVIDER,
    fetch: dependencies.fetch,
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
