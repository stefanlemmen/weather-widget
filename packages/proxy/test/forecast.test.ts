import {
  ForecastResponseSchema,
  PROBLEM_DETAILS_MEDIA_TYPE,
  ProblemDetailsSchema,
} from "@weather-widget/contract";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import recordedCurrentConditions from "../fixtures/current-nieuwegein.json" with { type: "json" };
import { createProxy } from "../src/index.ts";

const TEST_KEY = "test-key-that-must-stay-secret";
const liveEnvironment = { OPENWEATHER_API_KEY: TEST_KEY };
const RECORDED_TEMPERATURE = 5.09;

const jsonResponse = (body: unknown, status = 200) =>
  Response.json(body, { status });

const recordingFetch = (respond: () => Promise<Response>) => {
  const requestedUrls: URL[] = [];
  const fetch: typeof globalThis.fetch = (input) => {
    requestedUrls.push(new URL(input instanceof Request ? input.url : input));
    return respond();
  };
  return { fetch, requestedUrls };
};

const proxyAnswering = (respond: () => Promise<Response>) => {
  const weatherProvider = recordingFetch(respond);
  const proxy = createProxy(liveEnvironment, {
    fetch: weatherProvider.fetch,
  });
  return { proxy, requestedUrls: weatherProvider.requestedUrls };
};

const healthyProxy = () =>
  proxyAnswering(() =>
    Promise.resolve(jsonResponse(recordedCurrentConditions)),
  );

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
  it("answers with the current temperature from the Weather provider", async () => {
    const { proxy } = healthyProxy();

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    expect(response.status).toBe(200);
    expect(v.parse(ForecastResponseSchema, await response.json())).toEqual({
      parts: {
        current: {
          status: "ok",
          data: { temperatureCelsius: RECORDED_TEMPERATURE },
        },
      },
    });
  });

  it("asks the Weather provider's current endpoint for metric data at coordinates rounded to 2 decimals", async () => {
    const { proxy, requestedUrls } = healthyProxy();

    await proxy.request("/api/forecast?latitude=52.0349&longitude=-5.0751");

    expect(requestedUrls).toHaveLength(1);
    const [url] = requestedUrls;
    expect(`${url?.origin ?? ""}${url?.pathname ?? ""}`).toBe(
      "https://api.openweathermap.org/data/4.0/onecall/current",
    );
    expect(url?.searchParams.get("lat")).toBe("52.03");
    expect(url?.searchParams.get("lon")).toBe("-5.08");
    expect(url?.searchParams.get("units")).toBe("metric");
    expect(url?.searchParams.get("appid")).toBe(TEST_KEY);
  });

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

  it.each([
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
  ])(
    "answers 503 Problem Details when the Weather provider %s",
    async (_, respond) => {
      const { proxy } = proxyAnswering(respond);

      const response = await proxy.request(
        "/api/forecast?latitude=52.03&longitude=5.08",
      );

      await expectProblemDetails(response, 503);
    },
  );

  it("answers 503 Problem Details when the Weather provider doesn't answer in time", async () => {
    const neverAnswering: typeof globalThis.fetch = (_, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation timed out.", "TimeoutError"));
        });
      });
    const proxy = createProxy(liveEnvironment, {
      fetch: neverAnswering,
      weatherProviderTimeoutMs: 10,
    });

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    await expectProblemDetails(response, 503);
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

    expect(v.parse(ForecastResponseSchema, await response.json())).toEqual({
      parts: {
        current: {
          status: "ok",
          data: { temperatureCelsius: RECORDED_TEMPERATURE },
        },
      },
    });
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
