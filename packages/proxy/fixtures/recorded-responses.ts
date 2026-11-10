import recordedCurrentWeather from "./current-nieuwegein.json" with { type: "json" };
import recordedDailyForecast from "./daily-nieuwegein.json" with { type: "json" };
import recordedHourlyForecast from "./hourly-nieuwegein.json" with { type: "json" };
import recordedReverseGeocoding from "./reverse-nieuwegein.json" with { type: "json" };
import recordedParijsSearch from "./search-parijs.json" with { type: "json" };
import recordedParisSearch from "./search-paris.json" with { type: "json" };
import recordedSearchWithoutResults from "./search-parjs.json" with { type: "json" };
import { SEARCH_CALL } from "../src/search-provider.ts";
import { WEATHER_PROVIDER_CALLS } from "../src/weather-provider.ts";

export const RECORDED_RESPONSES = {
  current: recordedCurrentWeather,
  hourly: recordedHourlyForecast,
  daily: recordedDailyForecast,
  reverseGeocoding: recordedReverseGeocoding,
} as const;

export const RECORDED_SEARCHES = {
  paris: recordedParisSearch,
  parijs: recordedParijsSearch,
  noResults: recordedSearchWithoutResults,
} as const;

const NOT_RECORDED_STATUS = 404;

export const urlOf = (input: Parameters<typeof globalThis.fetch>[0]): URL =>
  new URL(input instanceof Request ? input.url : input);

const recordedFetchFor = (
  recordedByUrl: Iterable<readonly [url: string, recorded: unknown]>,
): typeof globalThis.fetch => {
  const recordedByPath = new Map(
    Array.from(recordedByUrl, ([url, recorded]) => [
      new URL(url).pathname,
      recorded,
    ]),
  );
  return (input) => {
    const url = urlOf(input);
    const recorded = recordedByPath.get(url.pathname);
    return Promise.resolve(
      recorded === undefined
        ? new Response(null, { status: NOT_RECORDED_STATUS })
        : Response.json(recorded),
    );
  };
};

const RECORDED_SEARCHES_BY_TERM = new Map<string, unknown>([
  ["paris", RECORDED_SEARCHES.paris],
  ["parijs", RECORDED_SEARCHES.parijs],
]);

const recordedSearch: typeof globalThis.fetch = (input) => {
  const url = urlOf(input);
  const term = url.searchParams.get("name")?.toLocaleLowerCase() ?? "";
  return Promise.resolve(
    Response.json(
      RECORDED_SEARCHES_BY_TERM.get(term) ?? RECORDED_SEARCHES.noResults,
    ),
  );
};

const recordedWeather = recordedFetchFor([
  [WEATHER_PROVIDER_CALLS.current.url, RECORDED_RESPONSES.current],
  [WEATHER_PROVIDER_CALLS.hourly.url, RECORDED_RESPONSES.hourly],
  [WEATHER_PROVIDER_CALLS.daily.url, RECORDED_RESPONSES.daily],
  [
    WEATHER_PROVIDER_CALLS.reverseGeocoding.url,
    RECORDED_RESPONSES.reverseGeocoding,
  ],
]);

const SEARCH_PROVIDER_ORIGIN = new URL(SEARCH_CALL.url).origin;

export const recordedFetch: typeof globalThis.fetch = (input, init) =>
  urlOf(input).origin === SEARCH_PROVIDER_ORIGIN
    ? recordedSearch(input, init)
    : recordedWeather(input, init);
