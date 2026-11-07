import {
  HealthResponseSchema,
  PROBLEM_DETAILS_MEDIA_TYPE,
  ProblemDetailsSchema,
} from "@weather-widget/forecast-contract";
import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { createProxy } from "../src/index.ts";

const environmentWithKey = { OPENWEATHER_API_KEY: "test-key" };

describe("the Proxy", () => {
  it("answers the health route with status ok", async () => {
    const proxy = createProxy(environmentWithKey);

    const response = await proxy.request("/api/health");

    expect(response.status).toBe(200);
    expect(v.parse(HealthResponseSchema, await response.json())).toEqual({
      status: "ok",
    });
  });

  it("answers unknown routes with 404 Problem Details that are never cached", async () => {
    const proxy = createProxy(environmentWithKey);

    const response = await proxy.request("/api/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain(
      PROBLEM_DETAILS_MEDIA_TYPE,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(v.parse(ProblemDetailsSchema, await response.json()).status).toBe(
      404,
    );
  });

  it.each([
    ["missing", {}],
    ["empty", { OPENWEATHER_API_KEY: "" }],
    ["blank", { OPENWEATHER_API_KEY: "   " }],
  ])(
    "refuses to start when the Weather provider key is %s",
    (_, environment) => {
      expect(() => createProxy(environment)).toThrow(
        "OPENWEATHER_API_KEY is not set. Add it to .env for local development, or to the Vercel project's environment variables.",
      );
    },
  );
});
