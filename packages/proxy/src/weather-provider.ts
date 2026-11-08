import {
  CurrentConditionsSchema,
  type Coordinates,
  type CurrentConditions,
  type Location,
} from "@weather-widget/contract";
import * as v from "valibot";
import recordedCurrentConditions from "../fixtures/current-nieuwegein.json" with { type: "json" };
import recordedHourlyForecast from "../fixtures/hourly-nieuwegein.json" with { type: "json" };
import recordedReverseGeocoding from "../fixtures/reverse-nieuwegein.json" with { type: "json" };

const WEATHER_PROVIDER_ORIGIN = "https://api.openweathermap.org";
export const WEATHER_PROVIDER_CURRENT_URL = `${WEATHER_PROVIDER_ORIGIN}/data/4.0/onecall/current`;
export const WEATHER_PROVIDER_HOURLY_URL = `${WEATHER_PROVIDER_ORIGIN}/data/4.0/onecall/timeline/1h`;
export const WEATHER_PROVIDER_REVERSE_GEOCODING_URL = `${WEATHER_PROVIDER_ORIGIN}/geo/1.0/reverse`;
export const WEATHER_PROVIDER_TIMEOUT_MS = 3000;
const METRIC_UNITS = "metric";
const NAMES_WANTED = "1";
const MILLISECONDS_PER_SECOND = 1000;

const CurrentResponseSchema = v.pipe(
  v.object({
    timezone: v.pipe(v.string(), v.nonEmpty()),
    data: v.tuple([
      v.object({
        dt: v.number(),
        temp: v.number(),
        feels_like: v.number(),
        wind_speed: v.number(),
        wind_deg: v.number(),
      }),
    ]),
  }),
  v.transform(({ timezone, data: [now] }) => ({
    timeZone: timezone,
    temperatureCelsius: now.temp,
    feelsLikeCelsius: now.feels_like,
    windSpeedMetresPerSecond: now.wind_speed,
    windDirectionDegrees: now.wind_deg,
    observedAt: new Date(now.dt * MILLISECONDS_PER_SECOND).toISOString(),
  })),
);

const HourlyResponseSchema = v.pipe(
  v.object({
    data: v.tupleWithRest([v.object({ pop: v.number() })], v.unknown()),
  }),
  v.transform(({ data: [comingHour] }) => comingHour.pop),
);

const ReverseGeocodingResponseSchema = v.pipe(
  v.tupleWithRest(
    [v.object({ name: v.pipe(v.string(), v.trim(), v.nonEmpty()) })],
    v.unknown(),
  ),
  v.transform(([place]) => place.name),
);

export type WeatherProviderResult<TData> =
  | { readonly status: "ok"; readonly data: TData }
  | { readonly status: "error" };

export interface WeatherProviderForecast {
  readonly location: Location;
  readonly current: CurrentConditions;
}

export type FetchForecast = (
  coordinates: Coordinates,
) => Promise<WeatherProviderResult<WeatherProviderForecast>>;

const FAILED = { status: "error" } as const;

export const createLiveWeatherProvider = (options: {
  readonly key: string;
  readonly fetch: typeof globalThis.fetch;
  readonly timeoutMs: number;
}): FetchForecast => {
  const fetchParsed = async <TSchema extends v.GenericSchema>(
    endpoint: string,
    parameters: Readonly<Record<string, string>>,
    schema: TSchema,
  ): Promise<WeatherProviderResult<v.InferOutput<TSchema>>> => {
    const url = new URL(endpoint);
    url.search = new URLSearchParams({
      ...parameters,
      appid: options.key,
    }).toString();
    try {
      const response = await options.fetch(url, {
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) return FAILED;
      const parsed = v.safeParse(schema, await response.json());
      return parsed.success ? { status: "ok", data: parsed.output } : FAILED;
    } catch {
      return FAILED;
    }
  };

  return async ({ latitude, longitude }) => {
    const at = { lat: String(latitude), lon: String(longitude) };
    const [current, hourly, name] = await Promise.all([
      fetchParsed(
        WEATHER_PROVIDER_CURRENT_URL,
        { ...at, units: METRIC_UNITS },
        CurrentResponseSchema,
      ),
      fetchParsed(
        WEATHER_PROVIDER_HOURLY_URL,
        { ...at, units: METRIC_UNITS },
        HourlyResponseSchema,
      ),
      fetchParsed(
        WEATHER_PROVIDER_REVERSE_GEOCODING_URL,
        { ...at, limit: NAMES_WANTED },
        ReverseGeocodingResponseSchema,
      ),
    ]);
    if (current.status === "error" || hourly.status === "error") return FAILED;

    const { timeZone, ...conditions } = current.data;
    const conditionsInRange = v.safeParse(CurrentConditionsSchema, {
      ...conditions,
      precipitationChance: hourly.data,
    });
    if (!conditionsInRange.success) return FAILED;

    return {
      status: "ok",
      data: {
        location: {
          name: name.status === "ok" ? name.data : null,
          timeZone,
        },
        current: conditionsInRange.output,
      },
    };
  };
};

const RECORDED_RESPONSES: Readonly<Record<string, unknown>> = {
  [new URL(WEATHER_PROVIDER_CURRENT_URL).pathname]: recordedCurrentConditions,
  [new URL(WEATHER_PROVIDER_HOURLY_URL).pathname]: recordedHourlyForecast,
  [new URL(WEATHER_PROVIDER_REVERSE_GEOCODING_URL).pathname]:
    recordedReverseGeocoding,
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
