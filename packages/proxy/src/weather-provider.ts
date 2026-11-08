import {
  CurrentConditionsSchema,
  DAY,
  NIGHT,
  DailyForecastSchema,
  HourlyForecastSchema,
  type Coordinates,
  type ForecastPart,
  type ForecastResponse,
  type Result,
} from "@weather-widget/contract";
import * as v from "valibot";
import { conditionFor } from "./conditions.ts";
import recordedCurrentConditions from "../fixtures/current-nieuwegein.json" with { type: "json" };
import recordedDailyForecast from "../fixtures/daily-nieuwegein.json" with { type: "json" };
import recordedHourlyForecast from "../fixtures/hourly-nieuwegein.json" with { type: "json" };
import recordedReverseGeocoding from "../fixtures/reverse-nieuwegein.json" with { type: "json" };

const WEATHER_PROVIDER_ORIGIN = "https://api.openweathermap.org";
export const WEATHER_PROVIDER_TIMEOUT_MS = 3000;
const TIMEOUT_ERROR = "TimeoutError";
const FAILURE_REASONS = {
  timedOut: "timed out",
  unreachable: "unreachable",
  unexpectedResponse: "unexpected response",
} as const;
type FailureReason =
  (typeof FAILURE_REASONS)[keyof typeof FAILURE_REASONS] | `HTTP ${string}`;
const httpStatusReason = (status: number): FailureReason =>
  `HTTP ${String(status)}`;
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

const ConditionAndTimeOfDaySchema = v.pipe(
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
    timeOfDay: icon.endsWith(NIGHT_ICON_SUFFIX) ? NIGHT : DAY,
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
        weather: ConditionAndTimeOfDaySchema,
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
    weather: ConditionAndTimeOfDaySchema,
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

interface WeatherProviderCall<TSchema extends v.GenericSchema> {
  readonly name: string;
  readonly url: string;
  readonly schema: TSchema;
}

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
} satisfies Record<string, WeatherProviderCall<v.GenericSchema>>;

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

const FAILED = { status: "error" } as const;
const SKIPPED = Promise.resolve(undefined);

const failureReason = (error: unknown): FailureReason => {
  if (error instanceof DOMException && error.name === TIMEOUT_ERROR) {
    return FAILURE_REASONS.timedOut;
  }
  if (error instanceof SyntaxError) return FAILURE_REASONS.unexpectedResponse;
  return FAILURE_REASONS.unreachable;
};

const callFailed = (
  call: WeatherProviderCall<v.GenericSchema>,
  reason: FailureReason,
) => {
  console.error(`Weather provider ${call.name} call failed: ${reason}`);
  return FAILED;
};

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

const forecastFrom = (
  requested: readonly ForecastPart[],
  { current, hourly, daily, name }: WeatherProviderResponses,
): Result<ForecastResponse> => {
  const requestedHourly = requested.includes("hourly") ? hourly : undefined;
  const timeZoneOfASucceededPart =
    timeZoneOf(current) ?? timeZoneOf(requestedHourly) ?? timeZoneOf(daily);
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
        ...(requestedHourly && {
          hourly: partFrom(requestedHourly, ({ hours }) => hours),
        }),
        ...(daily && { daily: partFrom(daily, ({ days }) => days) }),
      },
    },
  };
};

export interface WeatherProviderOptions {
  readonly key: string;
  readonly fetch: typeof globalThis.fetch;
  readonly timeoutMs: number;
}

export const createLiveWeatherProvider = (
  options: WeatherProviderOptions,
): FetchForecast => {
  const fetchParsed = async <TSchema extends v.GenericSchema>(
    call: WeatherProviderCall<TSchema>,
    parameters: Readonly<Record<string, string>>,
  ): Promise<Result<v.InferOutput<TSchema>>> => {
    const url = new URL(call.url);
    url.search = new URLSearchParams({
      ...parameters,
      appid: options.key,
    }).toString();
    try {
      const response = await options.fetch(url, {
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) {
        return callFailed(call, httpStatusReason(response.status));
      }
      const parsed = v.safeParse(call.schema, await response.json());
      return parsed.success
        ? { status: "ok", data: parsed.output }
        : callFailed(call, FAILURE_REASONS.unexpectedResponse);
    } catch (error) {
      return callFailed(call, failureReason(error));
    }
  };

  return async ({ latitude, longitude }, parts) => {
    const at = { lat: String(latitude), lon: String(longitude) };
    const metricAt = { ...at, units: METRIC_UNITS };
    const wants = (part: ForecastPart) => parts.includes(part);
    const hourlyNeededForCurrentPrecipitation = wants("current");
    const [current, hourly, daily, name] = await Promise.all([
      wants("current")
        ? fetchParsed(WEATHER_PROVIDER_CALLS.current, metricAt)
        : SKIPPED,
      wants("hourly") || hourlyNeededForCurrentPrecipitation
        ? fetchParsed(WEATHER_PROVIDER_CALLS.hourly, metricAt)
        : SKIPPED,
      wants("daily")
        ? fetchParsed(WEATHER_PROVIDER_CALLS.daily, metricAt)
        : SKIPPED,
      fetchParsed(WEATHER_PROVIDER_CALLS.reverseGeocoding, {
        ...at,
        limit: NAMES_WANTED,
      }),
    ]);
    return forecastFrom(parts, { current, hourly, daily, name });
  };
};

const RECORDED_RESPONSES: Readonly<Record<string, unknown>> = {
  [new URL(WEATHER_PROVIDER_CALLS.current.url).pathname]:
    recordedCurrentConditions,
  [new URL(WEATHER_PROVIDER_CALLS.hourly.url).pathname]: recordedHourlyForecast,
  [new URL(WEATHER_PROVIDER_CALLS.daily.url).pathname]: recordedDailyForecast,
  [new URL(WEATHER_PROVIDER_CALLS.reverseGeocoding.url).pathname]:
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
