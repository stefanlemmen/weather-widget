import {
  ForecastResponseSchema,
  LocationsResponseSchema,
} from "@weather-widget/contract";
import * as v from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MISSING_WEATHER_PROVIDER_KEY_MESSAGE } from "../src/environment.ts";
import { createLocalProxy } from "../src/local-proxy.ts";

const FIXTURES_ENVIRONMENT = { PROVIDER_MODE: "fixtures" };

const blockNetwork = () =>
  vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(new Error("the network must not be used"));

describe("the local Proxy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("answers a Forecast from the recordings in fixture mode, without a key or a network call", async () => {
    const networkFetch = blockNetwork();
    const proxy = createLocalProxy(FIXTURES_ENVIRONMENT);

    const response = await proxy.request(
      "/api/forecast?latitude=52.03&longitude=5.08",
    );

    expect(
      v.parse(ForecastResponseSchema, await response.json()).location.name,
    ).toBe("Nieuwegein");
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("answers a search from the recordings in fixture mode, without a network call", async () => {
    const networkFetch = blockNetwork();
    const proxy = createLocalProxy(FIXTURES_ENVIRONMENT);

    const response = await proxy.request("/api/locations?name=Paris&locale=en");

    expect(
      v.parse(LocationsResponseSchema, await response.json()).locations,
    ).not.toHaveLength(0);
    expect(networkFetch).not.toHaveBeenCalled();
  });

  it("needs a key in live mode, the default", () => {
    expect(() => createLocalProxy({})).toThrow(
      MISSING_WEATHER_PROVIDER_KEY_MESSAGE,
    );
    expect(() => createLocalProxy({ PROVIDER_MODE: "live" })).toThrow(
      MISSING_WEATHER_PROVIDER_KEY_MESSAGE,
    );
  });

  it("refuses to start in an unknown provider mode", () => {
    expect(() =>
      createLocalProxy({
        PROVIDER_MODE: "recorded",
        OPENWEATHER_API_KEY: "test-key",
      }),
    ).toThrow("PROVIDER_MODE");
  });
});
