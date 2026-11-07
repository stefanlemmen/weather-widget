import type { Coordinates, CurrentConditions } from "@weather-widget/contract";
import * as v from "valibot";
import recordedCurrentConditions from "../fixtures/current-nieuwegein.json" with { type: "json" };

export const WEATHER_PROVIDER_CURRENT_URL =
  "https://api.openweathermap.org/data/4.0/onecall/current";
export const WEATHER_PROVIDER_TIMEOUT_MS = 3000;
const METRIC_UNITS = "metric";

const CurrentResponseSchema = v.object({
  data: v.tuple([v.object({ temp: v.number() })]),
});

export type WeatherProviderResult<TData> =
  | { readonly status: "ok"; readonly data: TData }
  | { readonly status: "error" };

export type FetchCurrentConditions = (
  coordinates: Coordinates,
) => Promise<WeatherProviderResult<CurrentConditions>>;

const toCurrentConditions = (body: unknown): CurrentConditions | undefined => {
  const result = v.safeParse(CurrentResponseSchema, body);
  return result.success
    ? { temperatureCelsius: result.output.data[0].temp }
    : undefined;
};

export const createLiveWeatherProvider =
  (options: {
    readonly key: string;
    readonly fetch: typeof globalThis.fetch;
    readonly timeoutMs: number;
  }): FetchCurrentConditions =>
  async ({ latitude, longitude }) => {
    const url = new URL(WEATHER_PROVIDER_CURRENT_URL);
    url.search = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      units: METRIC_UNITS,
      appid: options.key,
    }).toString();
    try {
      const response = await options.fetch(url, {
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) return { status: "error" };
      const data = toCurrentConditions(await response.json());
      return data ? { status: "ok", data } : { status: "error" };
    } catch {
      return { status: "error" };
    }
  };

const RECORDED_RESPONSES: Readonly<Record<string, unknown>> = {
  [new URL(WEATHER_PROVIDER_CURRENT_URL).pathname]: recordedCurrentConditions,
};

export const fixtureFetch: typeof globalThis.fetch = (input) => {
  const url = new URL(input instanceof Request ? input.url : input);
  const recorded = RECORDED_RESPONSES[url.pathname];
  return Promise.resolve(
    recorded === undefined
      ? new Response(null, { status: 404 })
      : Response.json(recorded),
  );
};
