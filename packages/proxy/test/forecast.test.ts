import {
  ForecastResponseSchema,
  PROBLEM_DETAILS_MEDIA_TYPE,
  ProblemDetailsSchema,
} from "@weather-widget/contract";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import recordedCurrentConditions from "../fixtures/current-nieuwegein.json" with { type: "json" };
import recordedHourlyForecast from "../fixtures/hourly-nieuwegein.json" with { type: "json" };
import recordedReverseGeocoding from "../fixtures/reverse-nieuwegein.json" with { type: "json" };
import { createProxy } from "../src/index.ts";

const TEST_KEY = "test-key-that-must-stay-secret";
const liveEnvironment = { OPENWEATHER_API_KEY: TEST_KEY };

const CURRENT_PATH = "/data/4.0/onecall/current";
const HOURLY_PATH = "/data/4.0/onecall/timeline/1h";
const REVERSE_GEOCODING_PATH = "/geo/1.0/reverse";

const RECORDED_NIEUWEGEIN_FORECAST = {
  location: { name: "Nieuwegein", timeZone: "Europe/Amsterdam" },
  parts: {
    current: {
      status: "ok",
      data: {
        temperatureCelsius: 8.85,
        feelsLikeCelsius: 6.93,
        windSpeedMetresPerSecond: 3.35,
        windDirectionDegrees: 198,
        precipitationChance: 0.85,
        observedAt: "2026-11-08T09:41:44.000Z",
      },
    },
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, { status });

type Respond = (url: URL) => Promise<Response>;

const recordingFetch = (respond: Respond) => {
  const requestedUrls: URL[] = [];
  const fetch: typeof globalThis.fetch = (input) => {
    const url = new URL(input instanceof Request ? input.url : input);
    requestedUrls.push(url);
    return respond(url);
  };
  return { fetch, requestedUrls };
};

const proxyAnswering = (respond: Respond) => {
  const weatherProvider = recordingFetch(respond);
  const proxy = createProxy(liveEnvironment, {
    fetch: weatherProvider.fetch,
  });
  return { proxy, requestedUrls: weatherProvider.requestedUrls };
};

const RECORDED_RESPONSES: Readonly<Record<string, unknown>> = {
  [CURRENT_PATH]: recordedCurrentConditions,
  [HOURLY_PATH]: recordedHourlyForecast,
  [REVERSE_GEOCODING_PATH]: recordedReverseGeocoding,
};

const answerFromRecordings: Respond = (url) =>
  Promise.resolve(jsonResponse(RECORDED_RESPONSES[url.pathname], 200));

const answerFromRecordingsExcept =
  (pathname: string, respond: Respond): Respond =>
  (url) =>
    url.pathname === pathname ? respond(url) : answerFromRecordings(url);

const healthyProxy = () => proxyAnswering(answerFromRecordings);

const requestedPath = (urls: readonly URL[], pathname: string) =>
  urls.find((url) => url.pathname === pathname);

const expectProblemDetails = async (response: Response, status: number) => {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain(
    PROBLEM_DETAILS_MEDIA_TYPE,
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  const body = await response.text();
  expect(body).not.toContain(TEST_KEY);
  expect(v.parse(ProblemDetailsSchema, JSON.parse(body)).status).toBe(status);
};

describe("the forecast route", () => {
  it("answers with the Location and its Current conditions from the Weather provider", async () => {
    const { proxy } = healthyProxy();

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    expect(response.status).toBe(200);
    expect(v.parse(ForecastResponseSchema, await response.json())).toEqual(
      RECORDED_NIEUWEGEIN_FORECAST,
    );
  });

  it.each([
    ["current", CURRENT_PATH],
    ["hourly", HOURLY_PATH],
  ])(
    "asks the Weather provider's %s endpoint for metric data at coordinates rounded to 2 decimals",
    async (_, pathname) => {
      const { proxy, requestedUrls } = healthyProxy();

      await proxy.request("/api/forecast?latitude=52.0349&longitude=-5.0751");

      const url = requestedPath(requestedUrls, pathname);
      expect(url?.origin).toBe("https://api.openweathermap.org");
      expect(url?.searchParams.get("lat")).toBe("52.03");
      expect(url?.searchParams.get("lon")).toBe("-5.08");
      expect(url?.searchParams.get("units")).toBe("metric");
      expect(url?.searchParams.get("appid")).toBe(TEST_KEY);
    },
  );

  it("asks reverse geocoding for one name at coordinates rounded to 2 decimals", async () => {
    const { proxy, requestedUrls } = healthyProxy();

    await proxy.request("/api/forecast?latitude=52.0349&longitude=-5.0751");

    const url = requestedPath(requestedUrls, REVERSE_GEOCODING_PATH);
    expect(url?.origin).toBe("https://api.openweathermap.org");
    expect(url?.searchParams.get("lat")).toBe("52.03");
    expect(url?.searchParams.get("lon")).toBe("-5.08");
    expect(url?.searchParams.get("limit")).toBe("1");
    expect(url?.searchParams.get("appid")).toBe(TEST_KEY);
  });

  it("asks the Weather provider once per endpoint", async () => {
    const { proxy, requestedUrls } = healthyProxy();

    await proxy.request("/api/forecast?latitude=52.03&longitude=5.08");

    expect(requestedUrls.map((url) => url.pathname).sort()).toEqual(
      [CURRENT_PATH, HOURLY_PATH, REVERSE_GEOCODING_PATH].sort(),
    );
  });

  it.each([
    [
      "fails",
      () => Promise.resolve(jsonResponse({ cod: 500, message: "oops" }, 500)),
    ],
    ["finds no name", () => Promise.resolve(jsonResponse([]))],
    [
      "answers with an unexpected shape",
      () => Promise.resolve(jsonResponse({ name: 5 })),
    ],
    ["can't be reached", () => Promise.reject(new TypeError("fetch failed"))],
  ])(
    "answers without a Location name and keeps the Forecast when reverse geocoding %s",
    async (_, respond) => {
      const { proxy } = proxyAnswering(
        answerFromRecordingsExcept(REVERSE_GEOCODING_PATH, respond),
      );

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08",
      );

      expect(response.status).toBe(200);
      expect(v.parse(ForecastResponseSchema, await response.json())).toEqual({
        ...RECORDED_NIEUWEGEIN_FORECAST,
        location: { ...RECORDED_NIEUWEGEIN_FORECAST.location, name: null },
      });
    },
  );

  it("keeps the Weather provider's key out of the response", async () => {
    const { proxy } = healthyProxy();

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    expect(await response.text()).not.toContain(TEST_KEY);
  });

  it("lets the CDN cache a forecast for 10 minutes and serve it stale for an hour on errors", async () => {
    const { proxy } = healthyProxy();

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=600, stale-while-revalidate=600, stale-if-error=3600",
    );
  });

  it.each([
    ["latitude is missing", "longitude=5.08"],
    ["longitude is missing", "latitude=52.03"],
    ["latitude is empty", "latitude=&longitude=5.08"],
    ["latitude is not a number", "latitude=north&longitude=5.08"],
    ["longitude is infinite", "latitude=52.03&longitude=Infinity"],
    ["latitude is above 90", "latitude=90.01&longitude=5.08"],
    ["latitude is below -90", "latitude=-90.01&longitude=5.08"],
    ["longitude is above 180", "latitude=52.03&longitude=180.01"],
    ["longitude is below -180", "latitude=52.03&longitude=-180.01"],
  ])(
    "rejects the request with 400 Problem Details when %s, without calling the Weather provider",
    async (_, query) => {
      const { proxy, requestedUrls } = healthyProxy();

      const response = await proxy.request(`/api/forecast?${query}`);

      await expectProblemDetails(response, 400);
      expect(requestedUrls).toHaveLength(0);
    },
  );

  it.each([
    ["the extreme corner", "latitude=-90&longitude=180"],
    ["the opposite corner", "latitude=90&longitude=-180"],
  ])("accepts coordinates at %s", async (_, query) => {
    const { proxy } = healthyProxy();

    const response = await proxy.request(`/api/forecast?${query}`);

    expect(response.status).toBe(200);
  });

  const PROVIDER_FAILURES: readonly (readonly [string, Respond])[] = [
    [
      "answers with a server error",
      () =>
        Promise.resolve(
          jsonResponse({ cod: 500, message: "internal provider detail" }, 500),
        ),
    ],
    [
      "rejects the key",
      () =>
        Promise.resolve(
          jsonResponse(
            { cod: 401, message: `Invalid API key ${TEST_KEY}` },
            401,
          ),
        ),
    ],
    [
      "is out of quota",
      () => Promise.resolve(jsonResponse({ cod: 429, message: "quota" }, 429)),
    ],
    [
      "answers with an unexpected shape",
      () => Promise.resolve(jsonResponse({ data: [] })),
    ],
    [
      "answers with something other than JSON",
      () => Promise.resolve(new Response("<html>oops</html>")),
    ],
    ["can't be reached", () => Promise.reject(new TypeError("fetch failed"))],
  ];

  it.each([
    ["a negative wind speed", CURRENT_PATH, { wind_speed: -1 }],
    ["a wind direction above 360 degrees", CURRENT_PATH, { wind_deg: 361 }],
    ["a chance of precipitation above 1", HOURLY_PATH, { pop: 1.5 }],
  ] as const)(
    "answers 503 Problem Details when the Weather provider reports %s",
    async (_, pathname, outOfRange) => {
      const recorded =
        pathname === CURRENT_PATH
          ? recordedCurrentConditions
          : recordedHourlyForecast;
      const [first, ...rest] = recorded.data;
      const { proxy } = proxyAnswering(
        answerFromRecordingsExcept(pathname, () =>
          Promise.resolve(
            jsonResponse({
              ...recorded,
              data: [{ ...first, ...outOfRange }, ...rest],
            }),
          ),
        ),
      );

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08",
      );

      await expectProblemDetails(response, 503);
    },
  );

  const FORECAST_ENDPOINTS = [
    ["current", CURRENT_PATH],
    ["hourly", HOURLY_PATH],
  ] as const;

  it.each(
    FORECAST_ENDPOINTS.flatMap(([endpoint, pathname]) =>
      PROVIDER_FAILURES.map(
        ([failure, respond]) => [endpoint, failure, pathname, respond] as const,
      ),
    ),
  )(
    "answers 503 Problem Details when the Weather provider's %s endpoint %s",
    async (_endpoint, _failure, pathname, respond) => {
      const { proxy } = proxyAnswering(
        answerFromRecordingsExcept(pathname, respond),
      );

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08",
      );

      await expectProblemDetails(response, 503);
    },
  );

  const timingOut =
    (pathname: string): typeof globalThis.fetch =>
    (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname !== pathname) return answerFromRecordings(url);
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation timed out.", "TimeoutError"));
        });
      });
    };

  it.each(FORECAST_ENDPOINTS)(
    "answers 503 Problem Details when the Weather provider's %s endpoint doesn't answer in time",
    async (_, pathname) => {
      const proxy = createProxy(liveEnvironment, {
        fetch: timingOut(pathname),
        weatherProviderTimeoutMs: 10,
      });

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08",
      );

      await expectProblemDetails(response, 503);
    },
  );

  it("answers without a Location name when reverse geocoding doesn't answer in time", async () => {
    const proxy = createProxy(liveEnvironment, {
      fetch: timingOut(REVERSE_GEOCODING_PATH),
      weatherProviderTimeoutMs: 10,
    });

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    expect(response.status).toBe(200);
    expect(
      v.parse(ForecastResponseSchema, await response.json()).location.name,
    ).toBeNull();
  });
});

describe("the Proxy in fixture mode", () => {
  it("answers from recorded Weather provider responses without a key or a network call", async () => {
    const weatherProvider = recordingFetch(() =>
      Promise.reject(new Error("the network must not be used")),
    );
    const proxy = createProxy(
      { WEATHER_PROVIDER_MODE: "fixtures" },
      { fetch: weatherProvider.fetch },
    );

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    expect(v.parse(ForecastResponseSchema, await response.json())).toEqual(
      RECORDED_NIEUWEGEIN_FORECAST,
    );
    expect(weatherProvider.requestedUrls).toHaveLength(0);
  });

  it("refuses to start in an unknown Weather provider mode", () => {
    expect(() =>
      createProxy({
        WEATHER_PROVIDER_MODE: "recorded",
        OPENWEATHER_API_KEY: TEST_KEY,
      }),
    ).toThrow("WEATHER_PROVIDER_MODE");
  });
});
