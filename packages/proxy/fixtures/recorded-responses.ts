import recordedCurrentConditions from "./current-nieuwegein.json" with { type: "json" };
import recordedDailyForecast from "./daily-nieuwegein.json" with { type: "json" };
import recordedHourlyForecast from "./hourly-nieuwegein.json" with { type: "json" };
import recordedReverseGeocoding from "./reverse-nieuwegein.json" with { type: "json" };
import recordedParijsSearch from "./search-parijs.json" with { type: "json" };
import recordedParisSearch from "./search-paris.json" with { type: "json" };
import recordedSearchWithoutResults from "./search-parjs.json" with { type: "json" };

export const RECORDED_RESPONSES = {
  current: recordedCurrentConditions,
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

export const recordedFetchFor = (
  recordedByUrl: Iterable<readonly [url: string, recorded: unknown]>,
): typeof globalThis.fetch => {
  const recordedByPath = new Map(
    Array.from(recordedByUrl, ([url, recorded]) => [
      new URL(url).pathname,
      recorded,
    ]),
  );
  return (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
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

export const recordedSearch: typeof globalThis.fetch = (input) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const term = url.searchParams.get("name")?.toLocaleLowerCase() ?? "";
  return Promise.resolve(
    Response.json(
      RECORDED_SEARCHES_BY_TERM.get(term) ?? RECORDED_SEARCHES.noResults,
    ),
  );
};
