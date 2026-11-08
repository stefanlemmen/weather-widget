import {
  CurrentConditionsSchema,
  DailyForecastSchema,
  HourlyForecastSchema,
  type Coordinates,
  type ForecastPart,
  type Location,
} from "@weather-widget/contract";
import * as v from "valibot";
import { conditionFor } from "./conditions.ts";
import recordedCurrentConditions from "../fixtures/current-nieuwegein.json" with { type: "json" };
import recordedDailyForecast from "../fixtures/daily-nieuwegein.json" with { type: "json" };
import recordedHourlyForecast from "../fixtures/hourly-nieuwegein.json" with { type: "json" };
import recordedReverseGeocoding from "../fixtures/reverse-nieuwegein.json" with { type: "json" };

const WEATHER_PROVIDER_ORIGIN = "https://api.openweathermap.org";
export const WEATHER_PROVIDER_CURRENT_URL = `${WEATHER_PROVIDER_ORIGIN}/data/4.0/onecall/current`;
export const WEATHER_PROVIDER_HOURLY_URL = `${WEATHER_PROVIDER_ORIGIN}/data/4.0/onecall/timeline/1h`;
export const WEATHER_PROVIDER_DAILY_URL = `${WEATHER_PROVIDER_ORIGIN}/data/4.0/onecall/timeline/1day`;
export const WEATHER_PROVIDER_REVERSE_GEOCODING_URL = `${WEATHER_PROVIDER_ORIGIN}/geo/1.0/reverse`;
export const WEATHER_PROVIDER_TIMEOUT_MS = 3000;
const METRIC_UNITS = "metric";
const NAMES_WANTED = "1";
const MILLISECONDS_PER_SECOND = 1000;
const ISO_DATE_LENGTH = "YYYY-MM-DD".length;

const isoTimestamp = (secondsSinceEpoch: number) =>
  new Date(secondsSinceEpoch * MILLISECONDS_PER_SECOND).toISOString();

const TimeZoneSchema = v.pipe(v.string(), v.nonEmpty());

const ConditionSchema = v.pipe(
  v.tupleWithRest([v.object({ id: v.number() })], v.unknown()),
  v.transform(([{ id }]) => conditionFor(id)),
);

const CurrentResponseSchema = v.pipe(
  v.object({
    timezone: TimeZoneSchema,
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
    observedAt: isoTimestamp(now.dt),
  })),
);

const HourRecordSchema = v.pipe(
  v.object({
    dt: v.number(),
    temp: v.number(),
    pop: v.number(),
    weather: ConditionSchema,
  }),
  v.transform((hour) => ({
    startsAt: isoTimestamp(hour.dt),
    condition: hour.weather,
    temperatureCelsius: hour.temp,
    precipitationChance: hour.pop,
  })),
);

const HourlyResponseSchema = v.pipe(
  v.object({
    timezone: TimeZoneSchema,
    data: v.tupleWithRest([HourRecordSchema], HourRecordSchema),
  }),
  v.transform(({ timezone, data }) => ({
    timeZone: timezone,
    comingHourPrecipitationChance: data[0].precipitationChance,
    hours: data,
  })),
);

const DailyResponseSchema = v.pipe(
  v.object({
    timezone: TimeZoneSchema,
    data: v.array(
      v.object({
        dt: v.number(),
        temp: v.object({ min: v.number(), max: v.number() }),
        pop: v.number(),
        weather: ConditionSchema,
      }),
    ),
  }),
  v.transform(({ timezone, data }) => ({
    timeZone: timezone,
    days: data.map((day) => ({
      date: isoTimestamp(day.dt).slice(0, ISO_DATE_LENGTH),
      condition: day.weather,
      lowCelsius: day.temp.min,
      highCelsius: day.temp.max,
      precipitationChance: day.pop,
    })),
  })),
);

const ForecastPartsSchema = v.object({
  current: v.optional(CurrentConditionsSchema),
  hourly: v.optional(HourlyForecastSchema),
  daily: v.optional(DailyForecastSchema),
});

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

export type WeatherProviderForecastParts = v.InferOutput<
  typeof ForecastPartsSchema
>;

export interface WeatherProviderForecast {
  readonly location: Location;
  readonly parts: WeatherProviderForecastParts;
}

export type FetchForecast = (
  coordinates: Coordinates,
  parts: readonly ForecastPart[],
) => Promise<WeatherProviderResult<WeatherProviderForecast>>;

const FAILED = { status: "error" } as const;
const SKIPPED = Promise.resolve(undefined);

export interface WeatherProviderOptions {
  readonly key: string;
  readonly fetch: typeof globalThis.fetch;
  readonly timeoutMs: number;
}

export const createLiveWeatherProvider = (
  options: WeatherProviderOptions,
): FetchForecast => {
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

  return async ({ latitude, longitude }, parts) => {
    const at = { lat: String(latitude), lon: String(longitude) };
    const metricAt = { ...at, units: METRIC_UNITS };
    const wants = (part: ForecastPart) => parts.includes(part);
    const [current, hourly, daily, name] = await Promise.all([
      wants("current")
        ? fetchParsed(
            WEATHER_PROVIDER_CURRENT_URL,
            metricAt,
            CurrentResponseSchema,
          )
        : SKIPPED,
      wants("current") || wants("hourly")
        ? fetchParsed(
            WEATHER_PROVIDER_HOURLY_URL,
            metricAt,
            HourlyResponseSchema,
          )
        : SKIPPED,
      wants("daily")
        ? fetchParsed(WEATHER_PROVIDER_DAILY_URL, metricAt, DailyResponseSchema)
        : SKIPPED,
      fetchParsed(
        WEATHER_PROVIDER_REVERSE_GEOCODING_URL,
        { ...at, limit: NAMES_WANTED },
        ReverseGeocodingResponseSchema,
      ),
    ]);
    if (
      current?.status === "error" ||
      hourly?.status === "error" ||
      daily?.status === "error"
    ) {
      return FAILED;
    }

    const timeZone =
      current?.data.timeZone ?? hourly?.data.timeZone ?? daily?.data.timeZone;
    if (timeZone === undefined) return FAILED;

    const partsInRange = v.safeParse(ForecastPartsSchema, {
      ...(current &&
        hourly && {
          current: {
            ...current.data,
            precipitationChance: hourly.data.comingHourPrecipitationChance,
          },
        }),
      ...(wants("hourly") && hourly && { hourly: hourly.data.hours }),
      ...(daily && { daily: daily.data.days }),
    });
    if (!partsInRange.success) return FAILED;

    return {
      status: "ok",
      data: {
        location: {
          name: name.status === "ok" ? name.data : null,
          timeZone,
        },
        parts: partsInRange.output,
      },
    };
  };
};

const RECORDED_RESPONSES: Readonly<Record<string, unknown>> = {
  [new URL(WEATHER_PROVIDER_CURRENT_URL).pathname]: recordedCurrentConditions,
  [new URL(WEATHER_PROVIDER_HOURLY_URL).pathname]: recordedHourlyForecast,
  [new URL(WEATHER_PROVIDER_DAILY_URL).pathname]: recordedDailyForecast,
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
