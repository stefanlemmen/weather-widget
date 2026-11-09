import {
  LocationsResponseSchema,
  PROBLEM_DETAILS_MEDIA_TYPE,
  ProblemDetailsSchema,
} from "@weather-widget/contract";
import * as v from "valibot";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RECORDED_SEARCHES,
  recordedFetch,
  urlOf,
} from "../fixtures/recorded-responses.ts";
import { createProxy } from "../src/index.ts";

const environmentWithKey = { OPENWEATHER_API_KEY: "test-key" };
const SEARCH_PROVIDER_ORIGIN = "https://geocoding-api.open-meteo.com";
const SEARCH_PATH = "/v1/search";

const RECORDED_PARIS_LOCATIONS = [
  {
    name: "Paris",
    region: "Île-de-France Region",
    country: "France",
    latitude: 48.85341,
    longitude: 2.3488,
  },
  {
    name: "Paris",
    region: "Texas",
    country: "United States",
    latitude: 33.66094,
    longitude: -95.55551,
  },
  {
    name: "Paris",
    region: "Tennessee",
    country: "United States",
    latitude: 36.302,
    longitude: -88.32671,
  },
  {
    name: "Paris",
    region: "Kentucky",
    country: "United States",
    latitude: 38.2098,
    longitude: -84.25299,
  },
  {
    name: "Paris",
    region: "Illinois",
    country: "United States",
    latitude: 39.61115,
    longitude: -87.69614,
  },
];

type Respond = (url: URL) => Promise<Response>;

const jsonResponse = (body: unknown, status = 200) =>
  Promise.resolve(Response.json(body, { status }));

const proxyAnswering = (respond: Respond) => {
  const requestedUrls: URL[] = [];
  const fetch: typeof globalThis.fetch = (input) => {
    const url = urlOf(input);
    requestedUrls.push(url);
    return respond(url);
  };
  return { proxy: createProxy(environmentWithKey, { fetch }), requestedUrls };
};

const answering = (recorded: unknown) =>
  proxyAnswering(() => jsonResponse(recorded));

const recordedParis = () => answering(RECORDED_SEARCHES.paris);

const expectProblemDetails = async (response: Response, status: number) => {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain(
    PROBLEM_DETAILS_MEDIA_TYPE,
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(v.parse(ProblemDetailsSchema, await response.json()).status).toBe(
    status,
  );
};

const locationsIn = async (response: Response) =>
  v.parse(LocationsResponseSchema, await response.json()).locations;

const timingOut: typeof globalThis.fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("The operation timed out.", "TimeoutError"));
    });
  });

const SEARCH_PROVIDER_FAILURES: readonly (readonly [
  string,
  Respond,
  string,
])[] = [
  [
    "answers with a server error",
    () => jsonResponse({ error: true, reason: "internal detail" }, 500),
    "HTTP 500",
  ],
  [
    "answers with an unexpected shape",
    () => jsonResponse({ results: [{ name: 5 }] }),
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
];

describe("the locations route", () => {
  it("answers with up to 5 Locations from the Search provider, with region and country", async () => {
    const { proxy } = recordedParis();

    const response = await proxy.request("/api/locations?name=Paris&locale=en");

    expect(response.status).toBe(200);
    expect(await locationsIn(response)).toEqual(RECORDED_PARIS_LOCATIONS);
  });

  it("asks the Search provider for 5 Locations in the requested locale", async () => {
    const { proxy, requestedUrls } = recordedParis();

    await proxy.request("/api/locations?name=Parijs&locale=nl");

    expect(requestedUrls).toHaveLength(1);
    const [url] = requestedUrls;
    expect(url?.origin).toBe(SEARCH_PROVIDER_ORIGIN);
    expect(url?.pathname).toBe(SEARCH_PATH);
    expect(url?.searchParams.get("name")).toBe("Parijs");
    expect(url?.searchParams.get("count")).toBe("5");
    expect(url?.searchParams.get("language")).toBe("nl");
    expect(url?.searchParams.get("format")).toBe("json");
  });

  it("searches for the term without the spaces around it", async () => {
    const { proxy, requestedUrls } = recordedParis();

    await proxy.request("/api/locations?name=%20%20Paris%20&locale=en");

    expect(requestedUrls[0]?.searchParams.get("name")).toBe("Paris");
  });

  it("answers with no Locations when the Search provider finds none", async () => {
    const { proxy } = answering(RECORDED_SEARCHES.noResults);

    const response = await proxy.request("/api/locations?name=Parjs&locale=en");

    expect(response.status).toBe(200);
    expect(await locationsIn(response)).toEqual([]);
  });

  it.each([
    ["doesn't know", {}],
    ["sends blank", { admin1: " ", country: "" }],
  ])(
    "leaves out the region and country the Search provider %s",
    async (_, context) => {
      const { proxy } = answering({
        results: [
          { name: "Null Island", latitude: 0, longitude: 0, ...context },
        ],
      });

      const response = await proxy.request(
        "/api/locations?name=Null%20Island&locale=en",
      );

      expect(await locationsIn(response)).toEqual([
        {
          name: "Null Island",
          region: null,
          country: null,
          latitude: 0,
          longitude: 0,
        },
      ]);
    },
  );

  it("answers with at most 5 Locations when the Search provider sends more", async () => {
    const [first] = RECORDED_SEARCHES.paris.results;
    const { proxy } = answering({
      results: Array.from({ length: 7 }, () => first),
    });

    const response = await proxy.request("/api/locations?name=Paris&locale=en");

    expect(await locationsIn(response)).toHaveLength(5);
  });

  it("lets the CDN cache the Locations found for 10 minutes and serve them stale for an hour on errors", async () => {
    const { proxy } = recordedParis();

    const response = await proxy.request("/api/locations?name=Paris&locale=en");

    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=0, s-maxage=600, stale-while-revalidate=600, stale-if-error=3600",
    );
  });

  it.each([
    ["the search term is missing", "locale=en"],
    ["the search term is empty", "name=&locale=en"],
    ["the search term is blank", "name=%20%20&locale=en"],
    [
      "the search term is longer than 100 characters",
      `name=${"a".repeat(101)}&locale=en`,
    ],
    ["the locale is missing", "name=Paris"],
    ["the locale is unknown", "name=Paris&locale=fr"],
  ])(
    "rejects the request with 400 Problem Details when %s, without calling the Search provider",
    async (_, query) => {
      const { proxy, requestedUrls } = recordedParis();

      const response = await proxy.request(`/api/locations?${query}`);

      await expectProblemDetails(response, 400);
      expect(requestedUrls).toHaveLength(0);
    },
  );

  it.each(SEARCH_PROVIDER_FAILURES)(
    "answers 503 Problem Details when the Search provider %s",
    async (_, respond) => {
      const { proxy } = proxyAnswering(respond);

      const response = await proxy.request(
        "/api/locations?name=Paris&locale=en",
      );

      await expectProblemDetails(response, 503);
    },
  );

  it("answers 503 Problem Details when the Search provider doesn't answer in time", async () => {
    const proxy = createProxy(environmentWithKey, {
      fetch: timingOut,
      searchProviderTimeoutMs: 10,
    });

    const response = await proxy.request("/api/locations?name=Paris&locale=en");

    await expectProblemDetails(response, 503);
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

    it("logs nothing when the search succeeds", async () => {
      const { proxy } = recordedParis();

      await proxy.request("/api/locations?name=Paris&locale=en");

      expect(errorLog).not.toHaveBeenCalled();
    });

    it.each(SEARCH_PROVIDER_FAILURES)(
      "logs why the Search provider failed when it %s, without the search term",
      async (_, respond, reason) => {
        const { proxy } = proxyAnswering(respond);

        await proxy.request("/api/locations?name=Nieuwegein&locale=en");

        expect(errorLog).toHaveBeenCalledOnce();
        expect(logged()).toContain("Search provider");
        expect(logged()).toContain(reason);
        expect(logged()).not.toContain("Nieuwegein");
      },
    );
  });
});

describe("the locations route with the recorded fetch", () => {
  const recordedProxy = () =>
    createProxy(environmentWithKey, { fetch: recordedFetch });

  it("answers from the recorded Search provider responses", async () => {
    const proxy = recordedProxy();

    const response = await proxy.request("/api/locations?name=Paris&locale=en");

    expect(await locationsIn(response)).toEqual(RECORDED_PARIS_LOCATIONS);
  });

  it("finds a recorded search whatever its case", async () => {
    const proxy = recordedProxy();

    const response = await proxy.request(
      "/api/locations?name=parijs&locale=nl",
    );

    expect((await locationsIn(response)).map(({ country }) => country)).toEqual(
      ["Frankrijk", "België"],
    );
  });

  it("finds no Locations for a search that wasn't recorded", async () => {
    const proxy = recordedProxy();

    const response = await proxy.request(
      "/api/locations?name=Atlantis&locale=en",
    );

    expect(await locationsIn(response)).toEqual([]);
  });
});
