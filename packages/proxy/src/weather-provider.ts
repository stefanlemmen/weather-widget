import {
  CurrentConditionsSchema,
  DAY,
  NIGHT,
  DailyForecastSchema,
  FAILED,
  HourlyForecastSchema,
  type Coordinates,
  type ForecastPart,
  type ForecastResponse,
  type Result,
} from "@weather-widget/contract";
import * as v from "valibot";
import {
  RECORDED_RESPONSES,
  recordedFetchFor,
} from "../fixtures/recorded-responses.ts";
import { conditionFor } from "./weather-provider-conditions.ts";
import { PROVIDER_MODES, type Environment } from "./environment.ts";
import {
  fetchParsedWith,
  type ProviderCall,
  type ProviderOptions,
} from "./provider-call.ts";

const WEATHER_PROVIDER_ORIGIN = "https://api.openweathermap.org";
const WEATHER_PROVIDER_TIMEOUT_MS = 3000;
const FIXTURE_KEY = "fixtures";
const WEATHER_PROVIDER = "Weather provider";
const METRIC_UNITS = "metric";
const NAMES_WANTED = "1";
const MILLISECONDS_PER_SECOND = 1000;
const ISO_DATE_LENGTH = "YYYY-MM-DD".length;

const isoTimestamp = (secondsSinceEpoch: number) =>
  new Date(secondsSinceEpoch * MILLISECONDS_PER_SECOND).toISOString();

const TimeZoneSchema = v.pipe(v.string(), v.nonEmpty());

const DAY_OR_NIGHT_ICON = /^\d{2}[dn]$/;
const NIGHT_ICON_SUFFIX = "n";

const ConditionSchema = v.pipe(
  v.tupleWithRest([v.object({ id: v.number() })], v.unknown()),
  v.transform(([{ id }]) => conditionFor(id)),
);

const ConditionAndDaylightSchema = v.pipe(
  v.tupleWithRest(
    [
      v.object({
        id: v.number(),
        icon: v.pipe(v.string(), v.regex(DAY_OR_NIGHT_ICON)),
      }),
    ],
    v.unknown(),
  ),
  v.transform(([{ id, icon }]) => ({
    condition: conditionFor(id),
    daylight: icon.endsWith(NIGHT_ICON_SUFFIX) ? NIGHT : DAY,
  })),
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
        weather: ConditionAndDaylightSchema,
      }),
    ]),
  }),
  v.transform(({ timezone, data: [now] }) => ({
    timeZone: timezone,
    conditions: {
      ...now.weather,
      temperatureCelsius: now.temp,
      feelsLikeCelsius: now.feels_like,
      windSpeedMetresPerSecond: now.wind_speed,
      windDirectionDegrees: now.wind_deg,
      observedAt: isoTimestamp(now.dt),
    },
  })),
  v.object({
    timeZone: v.string(),
    conditions: v.omit(CurrentConditionsSchema, ["precipitationChance"]),
  }),
);

const HourRecordSchema = v.pipe(
  v.object({
    dt: v.number(),
    temp: v.number(),
    pop: v.number(),
    weather: ConditionAndDaylightSchema,
  }),
  v.transform((hour) => ({
    startsAt: isoTimestamp(hour.dt),
    ...hour.weather,
    temperatureCelsius: hour.temp,
    precipitationChance: hour.pop,
  })),
);

const HourlyResponseSchema = v.pipe(
  v.object({
    timezone: TimeZoneSchema,
    data: v.pipe(v.array(HourRecordSchema), v.nonEmpty()),
  }),
  v.transform(({ timezone, data }) => ({
    timeZone: timezone,
    hours: data,
  })),
  v.object({ timeZone: v.string(), hours: HourlyForecastSchema }),
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
  v.object({ timeZone: v.string(), days: DailyForecastSchema }),
);

const ReverseGeocodingResponseSchema = v.union([
  v.pipe(
    v.strictTuple([]),
    v.transform(() => null),
  ),
  v.pipe(
    v.tupleWithRest(
      [v.object({ name: v.pipe(v.string(), v.trim(), v.nonEmpty()) })],
      v.unknown(),
    ),
    v.transform(([place]) => place.name),
  ),
]);

const WEATHER_PROVIDER_CALLS = {
  current: {
    name: "current",
    url: `${WEATHER_PROVIDER_ORIGIN}/data/4.0/onecall/current`,
    schema: CurrentResponseSchema,
  },
  hourly: {
    name: "hourly",
    url: `${WEATHER_PROVIDER_ORIGIN}/data/4.0/onecall/timeline/1h`,
    schema: HourlyResponseSchema,
  },
  daily: {
    name: "daily",
    url: `${WEATHER_PROVIDER_ORIGIN}/data/4.0/onecall/timeline/1day`,
    schema: DailyResponseSchema,
  },
  reverseGeocoding: {
    name: "reverse geocoding",
    url: `${WEATHER_PROVIDER_ORIGIN}/geo/1.0/reverse`,
    schema: ReverseGeocodingResponseSchema,
  },
} satisfies Record<string, ProviderCall<v.GenericSchema>>;

type ResponseOf<TCall extends keyof typeof WEATHER_PROVIDER_CALLS> = Result<
  v.InferOutput<(typeof WEATHER_PROVIDER_CALLS)[TCall]["schema"]>
>;

interface WeatherProviderResponses {
  readonly current: ResponseOf<"current"> | undefined;
  readonly hourly: ResponseOf<"hourly"> | undefined;
  readonly daily: ResponseOf<"daily"> | undefined;
  readonly name: ResponseOf<"reverseGeocoding">;
}

export type FetchForecast = (
  coordinates: Coordinates,
  parts: readonly ForecastPart[],
) => Promise<Result<ForecastResponse>>;

const SKIPPED = Promise.resolve(undefined);

const partFrom = <TResponse, TPart>(
  response: Result<TResponse>,
  toPart: (data: TResponse) => TPart,
): Result<TPart> =>
  response.status === "ok"
    ? { status: "ok", data: toPart(response.data) }
    : FAILED;

const timeZoneOf = (
  response: Result<{ readonly timeZone: string }> | undefined,
) => (response?.status === "ok" ? response.data.timeZone : undefined);

const HOURLY_USES = {
  shown: "shown",
  forCurrentPrecipitationChance: "forCurrentPrecipitationChance",
  notFetched: "notFetched",
} as const;
type HourlyUse = (typeof HOURLY_USES)[keyof typeof HOURLY_USES];

const hourlyUseFor = (parts: readonly ForecastPart[]): HourlyUse => {
  if (parts.includes("hourly")) return HOURLY_USES.shown;
  if (parts.includes("current")) {
    return HOURLY_USES.forCurrentPrecipitationChance;
  }
  return HOURLY_USES.notFetched;
};

const forecastFrom = (
  hourlyUse: HourlyUse,
  { current, hourly, daily, name }: WeatherProviderResponses,
): Result<ForecastResponse> => {
  const shownHourly = hourlyUse === HOURLY_USES.shown ? hourly : undefined;
  const timeZoneOfASucceededPart =
    timeZoneOf(current) ?? timeZoneOf(shownHourly) ?? timeZoneOf(daily);
  if (timeZoneOfASucceededPart === undefined) return FAILED;

  const comingHourPrecipitationChance =
    hourly?.status === "ok"
      ? (hourly.data.hours[0]?.precipitationChance ?? null)
      : null;

  return {
    status: "ok",
    data: {
      location: {
        name: name.status === "ok" ? name.data : null,
        timeZone: timeZoneOfASucceededPart,
      },
      parts: {
        ...(current && {
          current: partFrom(current, ({ conditions }) => ({
            ...conditions,
            precipitationChance: comingHourPrecipitationChance,
          })),
        }),
        ...(shownHourly && {
          hourly: partFrom(shownHourly, ({ hours }) => hours),
        }),
        ...(daily && { daily: partFrom(daily, ({ days }) => days) }),
      },
    },
  };
};

interface WeatherProviderOptions extends ProviderOptions {
  readonly key: string;
}

export interface WeatherProviderDependencies {
  readonly fetch: typeof globalThis.fetch;
  readonly weatherProviderTimeoutMs?: number;
}

const fetchForecastWith = (options: WeatherProviderOptions): FetchForecast => {
  const fetchParsed = fetchParsedWith(options);
  const fetchWithKey = <TSchema extends v.GenericSchema>(
    call: ProviderCall<TSchema>,
    parameters: Readonly<Record<string, string>>,
  ) => fetchParsed(call, { ...parameters, appid: options.key });

  return async ({ latitude, longitude }, parts) => {
    const at = { lat: String(latitude), lon: String(longitude) };
    const metricAt = { ...at, units: METRIC_UNITS };
    const wants = (part: ForecastPart) => parts.includes(part);
    const hourlyUse = hourlyUseFor(parts);
    const [current, hourly, daily, name] = await Promise.all([
      wants("current")
        ? fetchWithKey(WEATHER_PROVIDER_CALLS.current, metricAt)
        : SKIPPED,
      hourlyUse !== HOURLY_USES.notFetched
        ? fetchWithKey(WEATHER_PROVIDER_CALLS.hourly, metricAt)
        : SKIPPED,
      wants("daily")
        ? fetchWithKey(WEATHER_PROVIDER_CALLS.daily, metricAt)
        : SKIPPED,
      fetchWithKey(WEATHER_PROVIDER_CALLS.reverseGeocoding, {
        ...at,
        limit: NAMES_WANTED,
      }),
    ]);
    return forecastFrom(hourlyUse, { current, hourly, daily, name });
  };
};

const recordedFetch = recordedFetchFor([
  [WEATHER_PROVIDER_CALLS.current.url, RECORDED_RESPONSES.current],
  [WEATHER_PROVIDER_CALLS.hourly.url, RECORDED_RESPONSES.hourly],
  [WEATHER_PROVIDER_CALLS.daily.url, RECORDED_RESPONSES.daily],
  [
    WEATHER_PROVIDER_CALLS.reverseGeocoding.url,
    RECORDED_RESPONSES.reverseGeocoding,
  ],
]);

const optionsFor = (
  environment: Environment,
  dependencies: WeatherProviderDependencies,
): WeatherProviderOptions => ({
  provider: WEATHER_PROVIDER,
  timeoutMs:
    dependencies.weatherProviderTimeoutMs ?? WEATHER_PROVIDER_TIMEOUT_MS,
  ...(environment.mode === PROVIDER_MODES.fixtures
    ? { key: FIXTURE_KEY, fetch: recordedFetch }
    : { key: environment.weatherProviderKey, fetch: dependencies.fetch }),
});

export const createWeatherProvider = (
  environment: Environment,
  dependencies: WeatherProviderDependencies,
): FetchForecast => fetchForecastWith(optionsFor(environment, dependencies));
