import * as v from "valibot";

export const HealthResponseSchema = v.object({
  status: v.literal("ok"),
});

export type HealthResponse = v.InferOutput<typeof HealthResponseSchema>;

export const PROXY_BASE_PATH = "/api";
export const FORECAST_PATH = "/forecast";

export const LATITUDE_RANGE = { min: -90, max: 90 } as const;
export const LONGITUDE_RANGE = { min: -180, max: 180 } as const;

type CoordinateRange = Readonly<{ min: number; max: number }>;

const coordinate = (range: CoordinateRange) =>
  v.pipe(v.number(), v.finite(), v.minValue(range.min), v.maxValue(range.max));

const coordinateQueryParameter = (range: CoordinateRange) =>
  v.pipe(v.string(), v.trim(), v.nonEmpty(), v.toNumber(), coordinate(range));

export const CoordinatesSchema = v.object({
  latitude: coordinate(LATITUDE_RANGE),
  longitude: coordinate(LONGITUDE_RANGE),
});

export type Coordinates = v.InferOutput<typeof CoordinatesSchema>;

export const FORECAST_PARTS = ["current", "hourly", "daily"] as const;

export type ForecastPart = (typeof FORECAST_PARTS)[number];

export const FORECAST_PARTS_SEPARATOR = ",";

const inCanonicalOrder = (parts: ForecastPart[]) =>
  parts.join() === FORECAST_PARTS.filter((part) => parts.includes(part)).join();

const ForecastPartsQueryParameterSchema = v.pipe(
  v.optional(v.string(), FORECAST_PARTS.join(FORECAST_PARTS_SEPARATOR)),
  v.transform((parts) => parts.split(FORECAST_PARTS_SEPARATOR)),
  v.array(v.picklist(FORECAST_PARTS)),
  v.check(inCanonicalOrder),
);

export const ForecastQuerySchema = v.object({
  latitude: coordinateQueryParameter(LATITUDE_RANGE),
  longitude: coordinateQueryParameter(LONGITUDE_RANGE),
  parts: ForecastPartsQueryParameterSchema,
});

export type ForecastQuery = v.InferOutput<typeof ForecastQuerySchema>;

export const CONDITIONS = [
  "clear",
  "partly-cloudy",
  "mostly-cloudy",
  "overcast",
  "fog",
  "haze",
  "drizzle",
  "rain",
  "sleet",
  "snow",
  "thunderstorm",
  "unknown",
] as const;

export type Condition = (typeof CONDITIONS)[number];

const ChanceSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(1));

export const CurrentConditionsSchema = v.object({
  temperatureCelsius: v.number(),
  feelsLikeCelsius: v.number(),
  windSpeedMetresPerSecond: v.pipe(v.number(), v.minValue(0)),
  windDirectionDegrees: v.pipe(v.number(), v.minValue(0), v.maxValue(360)),
  precipitationChance: v.nullable(ChanceSchema),
  observedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export type CurrentConditions = v.InferOutput<typeof CurrentConditionsSchema>;

export const HourSchema = v.object({
  startsAt: v.pipe(v.string(), v.isoTimestamp()),
  condition: v.picklist(CONDITIONS),
  temperatureCelsius: v.number(),
  precipitationChance: ChanceSchema,
});

export type Hour = v.InferOutput<typeof HourSchema>;

export const HourlyForecastSchema = v.array(HourSchema);

export type HourlyForecast = v.InferOutput<typeof HourlyForecastSchema>;

export const DaySchema = v.pipe(
  v.object({
    date: v.pipe(v.string(), v.isoDate()),
    condition: v.picklist(CONDITIONS),
    lowCelsius: v.number(),
    highCelsius: v.number(),
    precipitationChance: ChanceSchema,
  }),
  v.check(({ lowCelsius, highCelsius }) => lowCelsius <= highCelsius),
);

export type Day = v.InferOutput<typeof DaySchema>;

export const DailyForecastSchema = v.array(DaySchema);

export type DailyForecast = v.InferOutput<typeof DailyForecastSchema>;

export const LocationSchema = v.object({
  name: v.nullable(v.pipe(v.string(), v.nonEmpty())),
  timeZone: v.pipe(v.string(), v.nonEmpty()),
});

export type Location = v.InferOutput<typeof LocationSchema>;

const forecastPartResult = <TData extends v.GenericSchema>(data: TData) =>
  v.variant("status", [
    v.object({ status: v.literal("ok"), data }),
    v.object({ status: v.literal("error") }),
  ]);

export type Result<TData> =
  | { readonly status: "ok"; readonly data: TData }
  | { readonly status: "error" };

export type ForecastPartResult<TData> = Result<TData>;

export const ForecastResponseSchema = v.object({
  location: LocationSchema,
  parts: v.object({
    current: v.optional(forecastPartResult(CurrentConditionsSchema)),
    hourly: v.optional(forecastPartResult(HourlyForecastSchema)),
    daily: v.optional(forecastPartResult(DailyForecastSchema)),
  }),
});

export type ForecastResponse = v.InferOutput<typeof ForecastResponseSchema>;

export const ProblemDetailsSchema = v.object({
  type: v.string(),
  title: v.string(),
  status: v.pipe(v.number(), v.integer(), v.minValue(400), v.maxValue(599)),
  detail: v.optional(v.string()),
});

export type ProblemDetails = v.InferOutput<typeof ProblemDetailsSchema>;

export const PROBLEM_DETAILS_MEDIA_TYPE = "application/problem+json";
export const UNTYPED_PROBLEM = "about:blank";
