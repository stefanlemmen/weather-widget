import { describe, expect, it } from "vitest";
import { recordedFetch } from "../fixtures/recorded-responses.ts";
import { createProxy } from "../src/index.ts";

const ENVIRONMENT_WITH_KEY = { OPENWEATHER_API_KEY: "test-key" };
const HOST_PAGE_ORIGIN = "https://host-page.example";
const OTHER_HOST_PAGE_ORIGIN = "https://other-host-page.example";
const ANY_ORIGIN = "*";
const FAILING_STATUS = 500;

const FORECAST = "/api/forecast?latitude=52.0349&longitude=5.0751";
const LOCATIONS = "/api/locations?name=Paris&locale=en";
const HEALTH = "/api/health";
const INVALID_FORECAST = "/api/forecast?latitude=91";
const INVALID_LOCATIONS = "/api/locations?locale=en";
const UNKNOWN_ROUTE = "/api/does-not-exist";

const CACHED_FOR_TEN_MINUTES =
  "public, max-age=0, s-maxage=600, stale-while-revalidate=600, stale-if-error=3600";
const NEVER_CACHED = "no-store";

const failingProviders: typeof globalThis.fetch = () =>
  Promise.resolve(new Response(null, { status: FAILING_STATUS }));

const proxyWithRecordedProviders = () =>
  createProxy(ENVIRONMENT_WITH_KEY, { fetch: recordedFetch });
const proxyWithFailingProviders = () =>
  createProxy(ENVIRONMENT_WITH_KEY, { fetch: failingProviders });

const crossOriginGet = (
  path: string,
  { origin = HOST_PAGE_ORIGIN, proxy = proxyWithRecordedProviders() } = {},
) => proxy.request(path, { headers: { origin } });

const preflight = (path: string) =>
  proxyWithRecordedProviders().request(path, {
    method: "OPTIONS",
    headers: {
      origin: HOST_PAGE_ORIGIN,
      "access-control-request-method": "GET",
    },
  });

describe("the Proxy's CORS headers", () => {
  it.each([
    ["the health route", HEALTH, 200],
    ["a Forecast", FORECAST, 200],
    ["Locations", LOCATIONS, 200],
    ["an invalid forecast request", INVALID_FORECAST, 400],
    ["an invalid locations request", INVALID_LOCATIONS, 400],
    ["an unknown route", UNKNOWN_ROUTE, 404],
  ])("allows any origin to read %s", async (_, path, status) => {
    const response = await crossOriginGet(path);

    expect(response.status).toBe(status);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      ANY_ORIGIN,
    );
  });

  it.each([
    ["when the Weather provider fails", FORECAST],
    ["when the Search provider fails", LOCATIONS],
  ])("allows any origin to read the Problem Details %s", async (_, path) => {
    const response = await crossOriginGet(path, {
      proxy: proxyWithFailingProviders(),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      ANY_ORIGIN,
    );
  });

  it.each([
    ["a Forecast", FORECAST, CACHED_FOR_TEN_MINUTES],
    ["Locations", LOCATIONS, CACHED_FOR_TEN_MINUTES],
    ["an invalid forecast request", INVALID_FORECAST, NEVER_CACHED],
    ["an unknown route", UNKNOWN_ROUTE, NEVER_CACHED],
  ])(
    "keeps one cached copy of %s for every origin",
    async (_, path, cacheControl) => {
      const fromHostPage = await crossOriginGet(path);
      const fromOtherHostPage = await crossOriginGet(path, {
        origin: OTHER_HOST_PAGE_ORIGIN,
      });

      for (const response of [fromHostPage, fromOtherHostPage]) {
        expect(response.headers.get("cache-control")).toBe(cacheControl);
        expect(response.headers.get("vary")).toBeNull();
        expect(response.headers.get("access-control-allow-origin")).toBe(
          ANY_ORIGIN,
        );
      }
      expect(await fromOtherHostPage.text()).toBe(await fromHostPage.text());
    },
  );

  it.each([
    ["a GET", crossOriginGet],
    ["a preflight", preflight],
  ])("never allows credentials on %s", async (_, request) => {
    const response = await request(FORECAST);

    expect(response.headers.has("access-control-allow-credentials")).toBe(
      false,
    );
  });

  it.each([FORECAST, LOCATIONS, HEALTH, UNKNOWN_ROUTE])(
    "answers a preflight for %s by allowing GET only",
    async (path) => {
      const response = await preflight(path);

      expect(response.ok).toBe(true);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        ANY_ORIGIN,
      );
      expect(response.headers.get("access-control-allow-methods")).toBe("GET");
      expect(response.headers.get("vary")).toBeNull();
    },
  );
});
