import {
  ForecastResponseSchema,
  PROBLEM_DETAILS_MEDIA_TYPE,
  ProblemDetailsSchema,
} from "@weather-widget/contract";
import * as v from "valibot";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECORDED_RESPONSES,
  recordedFetch,
  urlOf,
} from "../fixtures/recorded-responses.ts";
import { createProxy } from "../src/index.ts";
import {
  RECORDED_NIEUWEGEIN_DAYS,
  RECORDED_NIEUWEGEIN_HOURS,
} from "./recorded-nieuwegein.ts";

const TEST_KEY = "test-key-that-must-stay-secret";
const environmentWithKey = { OPENWEATHER_API_KEY: TEST_KEY };

const CURRENT_PATH = "/data/4.0/onecall/current";
const HOURLY_PATH = "/data/4.0/onecall/timeline/1h";
const DAILY_PATH = "/data/4.0/onecall/timeline/1day";
const REVERSE_GEOCODING_PATH = "/geo/1.0/reverse";

const RECORDED_NIEUWEGEIN_FORECAST = {
  location: { name: "Nieuwegein", timeZone: "Europe/Amsterdam" },
  parts: {
    current: {
      status: "ok",
      data: {
        condition: "overcast",
        daylight: "day",
        temperatureCelsius: 8.85,
        feelsLikeCelsius: 6.93,
        windSpeedMetresPerSecond: 3.35,
        windDirectionDegrees: 198,
        precipitationChance: 0.85,
        observedAt: "2026-11-08T09:41:44.000Z",
      },
    },
    hourly: { status: "ok", data: RECORDED_NIEUWEGEIN_HOURS },
    daily: { status: "ok", data: RECORDED_NIEUWEGEIN_DAYS },
  },
};

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, { status });

type Respond = (url: URL) => Promise<Response>;

const recordingFetch = (respond: Respond) => {
  const requestedUrls: URL[] = [];
  const fetch: typeof globalThis.fetch = (input) => {
    const url = urlOf(input);
    requestedUrls.push(url);
    return respond(url);
  };
  return { fetch, requestedUrls };
};

const proxyAnswering = (respond: Respond) => {
  const weatherProvider = recordingFetch(respond);
  const proxy = createProxy(environmentWithKey, {
    fetch: weatherProvider.fetch,
  });
  return { proxy, requestedUrls: weatherProvider.requestedUrls };
};

const RECORDED_RESPONSES_BY_PATH: Readonly<Record<string, unknown>> = {
  [CURRENT_PATH]: RECORDED_RESPONSES.current,
  [HOURLY_PATH]: RECORDED_RESPONSES.hourly,
  [DAILY_PATH]: RECORDED_RESPONSES.daily,
  [REVERSE_GEOCODING_PATH]: RECORDED_RESPONSES.reverseGeocoding,
};

const answerFromRecordings: Respond = (url) =>
  Promise.resolve(jsonResponse(RECORDED_RESPONSES_BY_PATH[url.pathname], 200));

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
  it("answers with the Location and every Forecast part from the Weather provider", async () => {
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
    ["daily", DAILY_PATH],
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
      [CURRENT_PATH, HOURLY_PATH, DAILY_PATH, REVERSE_GEOCODING_PATH].sort(),
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

  const { current, hourly, daily } = RECORDED_NIEUWEGEIN_FORECAST.parts;
  const FAILED_PART = { status: "error" };

  const PARTS_WHEN_FAILING = {
    [CURRENT_PATH]: { current: FAILED_PART, hourly, daily },
    [HOURLY_PATH]: {
      current: {
        ...current,
        data: { ...current.data, precipitationChance: null },
      },
      hourly: FAILED_PART,
      daily,
    },
    [DAILY_PATH]: { current, hourly, daily: FAILED_PART },
  };

  it.each([
    ["a negative wind speed", CURRENT_PATH, { wind_speed: -1 }],
    ["a wind direction above 360 degrees", CURRENT_PATH, { wind_deg: 361 }],
    ["an hour's chance of precipitation above 1", HOURLY_PATH, { pop: 1.5 }],
    ["a day's chance of precipitation above 1", DAILY_PATH, { pop: 1.5 }],
    [
      "a day whose low is above its high",
      DAILY_PATH,
      { temp: { min: 11, max: 10 } },
    ],
  ] as const)(
    "fails only the Forecast parts that need an endpoint reporting %s",
    async (_, pathname, outOfRange) => {
      const recorded: { readonly data: readonly object[] } = {
        [CURRENT_PATH]: RECORDED_RESPONSES.current,
        [HOURLY_PATH]: RECORDED_RESPONSES.hourly,
        [DAILY_PATH]: RECORDED_RESPONSES.daily,
      }[pathname];
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

      expect(response.status).toBe(200);
      expect(
        v.parse(ForecastResponseSchema, await response.json()).parts,
      ).toEqual(PARTS_WHEN_FAILING[pathname]);
    },
  );

  const FORECAST_ENDPOINTS = [
    ["current", CURRENT_PATH, PARTS_WHEN_FAILING[CURRENT_PATH]],
    ["hourly", HOURLY_PATH, PARTS_WHEN_FAILING[HOURLY_PATH]],
    ["daily", DAILY_PATH, PARTS_WHEN_FAILING[DAILY_PATH]],
  ] as const;

  it.each(
    FORECAST_ENDPOINTS.flatMap(([endpoint, pathname, expectedParts]) =>
      PROVIDER_FAILURES.map(
        ([failure, respond]) =>
          [endpoint, failure, pathname, respond, expectedParts] as const,
      ),
    ),
  )(
    "fails only the Forecast parts that need the Weather provider's %s endpoint when it %s",
    async (_endpoint, _failure, pathname, respond, expectedParts) => {
      const { proxy } = proxyAnswering(
        answerFromRecordingsExcept(pathname, respond),
      );

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08",
      );

      expect(response.status).toBe(200);
      expect(v.parse(ForecastResponseSchema, await response.json())).toEqual({
        location: RECORDED_NIEUWEGEIN_FORECAST.location,
        parts: expectedParts,
      });
    },
  );

  it.each(PROVIDER_FAILURES)(
    "answers 503 Problem Details when every Forecast endpoint %s",
    async (_, respond) => {
      const { proxy } = proxyAnswering((url) =>
        url.pathname === REVERSE_GEOCODING_PATH
          ? answerFromRecordings(url)
          : respond(url),
      );

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08",
      );

      await expectProblemDetails(response, 503);
    },
  );

  it.each([
    ["current", CURRENT_PATH],
    ["hourly", HOURLY_PATH],
    ["daily", DAILY_PATH],
  ])(
    "answers 503 Problem Details when parts=%s and its only endpoint fails",
    async (parts, pathname) => {
      const { proxy } = proxyAnswering(
        answerFromRecordingsExcept(pathname, () =>
          Promise.resolve(jsonResponse({ cod: 500 }, 500)),
        ),
      );

      const response = await proxy.request(
        `/api/forecast?latitude=52.03&longitude=5.08&parts=${parts}`,
      );

      await expectProblemDetails(response, 503);
    },
  );

  it("lets the CDN cache a partial forecast for only a minute and serve it stale for an hour on errors", async () => {
    const { proxy } = proxyAnswering(
      answerFromRecordingsExcept(DAILY_PATH, () =>
        Promise.resolve(jsonResponse({ cod: 500 }, 500)),
      ),
    );

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=60, stale-if-error=3600",
    );
  });

  const timingOut =
    (pathname: string): typeof globalThis.fetch =>
    (input, init) => {
      const url = urlOf(input);
      if (url.pathname !== pathname) return answerFromRecordings(url);
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation timed out.", "TimeoutError"));
        });
      });
    };

  it.each(FORECAST_ENDPOINTS)(
    "fails only the Forecast parts that need the Weather provider's %s endpoint when it doesn't answer in time",
    async (_, pathname, expectedParts) => {
      const proxy = createProxy(environmentWithKey, {
        fetch: timingOut(pathname),
        weatherProviderTimeoutMs: 10,
      });

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08",
      );

      expect(response.status).toBe(200);
      expect(
        v.parse(ForecastResponseSchema, await response.json()).parts,
      ).toEqual(expectedParts);
    },
  );

  it("answers without a Location name when reverse geocoding doesn't answer in time", async () => {
    const proxy = createProxy(environmentWithKey, {
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

  describe("logs", () => {
    const errorLog = vi.fn();
    const logged = () => errorLog.mock.calls.flat().join("\n");

    beforeEach(() => {
      errorLog.mockReset();
      vi.spyOn(console, "error").mockImplementation(errorLog);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("logs nothing when every Weather provider call succeeds", async () => {
      const { proxy } = healthyProxy();

      await proxy.request("/api/forecast?latitude=52.03&longitude=5.08");

      expect(errorLog).not.toHaveBeenCalled();
    });

    it.each(PROVIDER_FAILURES)(
      "logs which Weather provider call failed when it %s, without coordinates or the key",
      async (_, respond) => {
        const { proxy } = proxyAnswering(
          answerFromRecordingsExcept(DAILY_PATH, respond),
        );

        await proxy.request("/api/forecast?latitude=52.0349&longitude=-5.0751");

        expect(errorLog).toHaveBeenCalledOnce();
        expect(logged()).toContain("daily");
        for (const secret of ["52.0", "5.07", "5.08", TEST_KEY]) {
          expect(logged()).not.toContain(secret);
        }
      },
    );

    it.each([
      [
        "answers with a server error",
        () => Promise.resolve(jsonResponse({ cod: 500 }, 500)),
        "HTTP 500",
      ],
      [
        "rejects the key",
        () => Promise.resolve(jsonResponse({ cod: 401 }, 401)),
        "HTTP 401",
      ],
      [
        "answers with an unexpected shape",
        () => Promise.resolve(jsonResponse({ data: [] })),
        "unexpected response",
      ],
      [
        "answers with something other than JSON",
        () => Promise.resolve(new Response("<html>oops</html>")),
        "unexpected response",
      ],
      [
        "can't be reached",
        () => Promise.reject(new TypeError("fetch failed")),
        "unreachable",
      ],
    ] as const)(
      "logs why a call failed when it %s",
      async (_, respond, reason) => {
        const { proxy } = proxyAnswering(
          answerFromRecordingsExcept(DAILY_PATH, respond),
        );

        await proxy.request("/api/forecast?latitude=52.03&longitude=5.08");

        expect(logged()).toContain(reason);
      },
    );

    it("logs a Weather provider call that doesn't answer in time", async () => {
      const proxy = createProxy(environmentWithKey, {
        fetch: timingOut(DAILY_PATH),
        weatherProviderTimeoutMs: 10,
      });

      await proxy.request("/api/forecast?latitude=52.03&longitude=5.08");

      expect(logged()).toContain("timed out");
    });

    it("doesn't log a Location without a name", async () => {
      const { proxy } = proxyAnswering(
        answerFromRecordingsExcept(REVERSE_GEOCODING_PATH, () =>
          Promise.resolve(jsonResponse([])),
        ),
      );

      await proxy.request("/api/forecast?latitude=52.03&longitude=5.08");

      expect(errorLog).not.toHaveBeenCalled();
    });
  });
});

describe("Forecast parts", () => {
  const PROVIDER_PATHS_FOR_PARTS = [
    ["current", [CURRENT_PATH, HOURLY_PATH]],
    ["hourly", [HOURLY_PATH]],
    ["daily", [DAILY_PATH]],
    ["current,hourly", [CURRENT_PATH, HOURLY_PATH]],
    ["current,daily", [CURRENT_PATH, HOURLY_PATH, DAILY_PATH]],
    ["hourly,daily", [HOURLY_PATH, DAILY_PATH]],
    ["current,hourly,daily", [CURRENT_PATH, HOURLY_PATH, DAILY_PATH]],
  ] as const;

  const { current, hourly, daily } = RECORDED_NIEUWEGEIN_FORECAST.parts;

  it.each([
    ["current", { current }],
    ["hourly", { hourly }],
    ["daily", { daily }],
    ["current,hourly", { current, hourly }],
    ["current,daily", { current, daily }],
    ["hourly,daily", { hourly, daily }],
    ["current,hourly,daily", { current, hourly, daily }],
  ])(
    "answers parts=%s with exactly those Forecast parts",
    async (parts, expectedParts) => {
      const { proxy } = healthyProxy();

      const response = await proxy.request(
        `/api/forecast?latitude=52.03&longitude=5.08&parts=${parts}`,
      );

      expect(response.status).toBe(200);
      const forecast = v.parse(ForecastResponseSchema, await response.json());
      expect(forecast).toEqual({
        location: RECORDED_NIEUWEGEIN_FORECAST.location,
        parts: expectedParts,
      });
    },
  );

  it.each(PROVIDER_PATHS_FOR_PARTS)(
    "asks the Weather provider only for what parts=%s needs",
    async (parts, providerPaths) => {
      const { proxy, requestedUrls } = healthyProxy();

      await proxy.request(
        `/api/forecast?latitude=52.03&longitude=5.08&parts=${parts}`,
      );

      expect(requestedUrls.map((url) => url.pathname).sort()).toEqual(
        [...providerPaths, REVERSE_GEOCODING_PATH].sort(),
      );
    },
  );

  it.each([
    ["an unknown part", "current,weekly"],
    ["parts out of order", "daily,current"],
    ["a repeated part", "hourly,hourly"],
    ["an empty list", ""],
    ["a trailing separator", "current,"],
    ["spaces instead of commas", "current hourly"],
    ["a part in capitals", "Current"],
  ])(
    "rejects %s with 400 Problem Details, without calling the Weather provider",
    async (_, parts) => {
      const { proxy, requestedUrls } = healthyProxy();

      const response = await proxy.request(
        `/api/forecast?latitude=52.03&longitude=5.08&parts=${encodeURIComponent(parts)}`,
      );

      await expectProblemDetails(response, 400);
      expect(requestedUrls).toHaveLength(0);
    },
  );

  it("takes the Location's time zone from the daily endpoint when only the Daily forecast is requested", async () => {
    const { proxy } = proxyAnswering(
      answerFromRecordingsExcept(DAILY_PATH, () =>
        Promise.resolve(
          jsonResponse({ ...RECORDED_RESPONSES.daily, timezone: "Asia/Tokyo" }),
        ),
      ),
    );

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08&parts=daily",
    );

    expect(
      v.parse(ForecastResponseSchema, await response.json()).location.timeZone,
    ).toBe("Asia/Tokyo");
  });
});

describe("the Daily forecast", () => {
  const dailyAnswering = (timezone: string, dts: readonly number[]) => {
    const [first] = RECORDED_RESPONSES.daily.data;
    return proxyAnswering(
      answerFromRecordingsExcept(DAILY_PATH, () =>
        Promise.resolve(
          jsonResponse({
            ...RECORDED_RESPONSES.daily,
            timezone,
            data: dts.map((dt) => ({ ...first, dt })),
          }),
        ),
      ),
    );
  };

  const secondsSinceEpoch = (isoTimestamp: string) =>
    Date.parse(isoTimestamp) / 1000;

  it.each(["Pacific/Pago_Pago", "Europe/Amsterdam", "Pacific/Kiritimati"])(
    "dates each day by the calendar day the Weather provider marks with UTC midnight, also for a Location in %s",
    async (timezone) => {
      const { proxy } = dailyAnswering(timezone, [
        secondsSinceEpoch("2026-11-08T00:00:00Z"),
        secondsSinceEpoch("2026-11-09T00:00:00Z"),
      ]);

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08&parts=daily",
      );

      const { daily } = v.parse(
        ForecastResponseSchema,
        await response.json(),
      ).parts;
      expect(
        daily?.status === "ok" ? daily.data.map((day) => day.date) : [],
      ).toEqual(["2026-11-08", "2026-11-09"]);
    },
  );
});

describe("Conditions", () => {
  const CONDITIONS_BY_CODE = [
    [[200, 201, 202, 210, 211, 212, 221, 230, 231, 232], "thunderstorm"],
    [[771, 781], "thunderstorm"],
    [[300, 301, 302, 310, 311, 312, 313, 314, 321], "drizzle"],
    [[500, 501, 502, 503, 504, 520, 521, 522, 531], "rain"],
    [[511, 611, 612, 613, 615, 616], "sleet"],
    [[600, 601, 602, 620, 621, 622], "snow"],
    [[701, 741], "fog"],
    [[711, 721, 731, 751, 761, 762], "haze"],
    [[800], "clear"],
    [[801, 802], "partly-cloudy"],
    [[803], "mostly-cloudy"],
    [[804], "overcast"],
    [[0, 199, 233, 400, 999], "unknown"],
  ] as const;

  const hourlyWithCode = (id: number) => {
    const [first, ...rest] = RECORDED_RESPONSES.hourly.data;
    return {
      ...RECORDED_RESPONSES.hourly,
      data: [{ ...first, weather: [{ ...first?.weather[0], id }] }, ...rest],
    };
  };

  it.each(
    CONDITIONS_BY_CODE.flatMap(([codes, condition]) =>
      codes.map((code) => [code, condition] as const),
    ),
  )(
    "maps Weather provider code %d to the Condition %s",
    async (code, condition) => {
      const { proxy } = proxyAnswering(
        answerFromRecordingsExcept(HOURLY_PATH, () =>
          Promise.resolve(jsonResponse(hourlyWithCode(code))),
        ),
      );

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08&parts=hourly",
      );

      const { hourly } = v.parse(
        ForecastResponseSchema,
        await response.json(),
      ).parts;
      expect(hourly?.status === "ok" && hourly.data[0]?.condition).toBe(
        condition,
      );
    },
  );
});

describe("day or night", () => {
  const { sunrise, sunset } = RECORDED_RESPONSES.current.data[0] ?? {
    sunrise: 0,
    sunset: 0,
  };
  const ONE_HOUR_IN_SECONDS = 60 * 60;

  const AROUND_SUNRISE_AND_SUNSET = [
    ["before sunrise", sunrise - ONE_HOUR_IN_SECONDS, "04n", "night"],
    ["at sunrise", sunrise, "04d", "day"],
    ["before sunset", sunset - ONE_HOUR_IN_SECONDS, "04d", "day"],
    ["at sunset", sunset, "04n", "night"],
  ] as const;

  const withWeatherAt = <TRecord extends { readonly weather: unknown[] }>(
    record: TRecord,
    dt: number,
    icon: string,
  ) => ({
    ...record,
    dt,
    weather: [{ id: 804, main: "Clouds", description: "", icon }],
  });

  const forecastAnswering = async (pathname: string, body: unknown) => {
    const { proxy } = proxyAnswering(
      answerFromRecordingsExcept(pathname, () =>
        Promise.resolve(jsonResponse(body)),
      ),
    );
    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );
    return v.parse(ForecastResponseSchema, await response.json()).parts;
  };

  it.each(AROUND_SUNRISE_AND_SUNSET)(
    "takes an hour %s as %s from the Weather provider's icon",
    async (_, dt, icon, daylight) => {
      const [first, ...rest] = RECORDED_RESPONSES.hourly.data;
      const { hourly } = await forecastAnswering(HOURLY_PATH, {
        ...RECORDED_RESPONSES.hourly,
        data: [...(first ? [withWeatherAt(first, dt, icon)] : []), ...rest],
      });

      expect(hourly?.status === "ok" && hourly.data[0]?.daylight).toBe(
        daylight,
      );
    },
  );

  it.each(AROUND_SUNRISE_AND_SUNSET)(
    "takes Current weather observed %s as %s from the Weather provider's icon",
    async (_, dt, icon, daylight) => {
      const [now] = RECORDED_RESPONSES.current.data;
      const { current } = await forecastAnswering(CURRENT_PATH, {
        ...RECORDED_RESPONSES.current,
        data: now ? [withWeatherAt(now, dt, icon)] : [],
      });

      expect(current?.status === "ok" && current.data.daylight).toBe(daylight);
    },
  );
  it("takes the Daily forecast's Conditions without the Weather provider's day or night", async () => {
    const { daily } = await forecastAnswering(DAILY_PATH, {
      ...RECORDED_RESPONSES.daily,
      data: RECORDED_RESPONSES.daily.data.map((day) => ({
        ...day,
        weather: [{ id: 800 }],
      })),
    });

    expect(daily?.status === "ok" && daily.data[0]?.condition).toBe("clear");
  });
});

describe("the Proxy with the recorded fetch", () => {
  it("answers from the recorded Weather provider responses", async () => {
    const proxy = createProxy(environmentWithKey, { fetch: recordedFetch });

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    expect(v.parse(ForecastResponseSchema, await response.json())).toEqual(
      RECORDED_NIEUWEGEIN_FORECAST,
    );
  });
});
