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

const COORDINATE_DECIMALS = 2;
const COORDINATE_FACTOR = 10 ** COORDINATE_DECIMALS;

const roundCoordinate = (value: number) =>
  Math.round(value * COORDINATE_FACTOR) / COORDINATE_FACTOR;

export const roundCoordinates = ({
  latitude,
  longitude,
}: Coordinates): Coordinates => ({
  latitude: roundCoordinate(latitude),
  longitude: roundCoordinate(longitude),
});

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

export const DAYLIGHTS = ["day", "night"] as const;

export type Daylight = (typeof DAYLIGHTS)[number];

export const DAY: Daylight = "day";
export const NIGHT: Daylight = "night";

const ConditionSchema = v.picklist(CONDITIONS);
const DaylightSchema = v.picklist(DAYLIGHTS);

const ChanceSchema = v.pipe(v.number(), v.minValue(0), v.maxValue(1));

export const CurrentWeatherSchema = v.object({
  condition: ConditionSchema,
  daylight: DaylightSchema,
  temperatureCelsius: v.number(),
  feelsLikeCelsius: v.number(),
  windSpeedMetresPerSecond: v.pipe(v.number(), v.minValue(0)),
  windDirectionDegrees: v.pipe(v.number(), v.minValue(0), v.maxValue(360)),
  precipitationChance: v.nullable(ChanceSchema),
  observedAt: v.pipe(v.string(), v.isoTimestamp()),
});

export type CurrentWeather = v.InferOutput<typeof CurrentWeatherSchema>;

export const HourSchema = v.object({
  startsAt: v.pipe(v.string(), v.isoTimestamp()),
  condition: ConditionSchema,
  daylight: DaylightSchema,
  temperatureCelsius: v.number(),
  precipitationChance: ChanceSchema,
});

export type Hour = v.InferOutput<typeof HourSchema>;

export const HourlyForecastSchema = v.array(HourSchema);

export type HourlyForecast = v.InferOutput<typeof HourlyForecastSchema>;

export const DaySchema = v.pipe(
  v.object({
    date: v.pipe(v.string(), v.isoDate()),
    condition: ConditionSchema,
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

const resultSchema = <TData extends v.GenericSchema>(data: TData) =>
  v.variant("status", [
    v.object({ status: v.literal("ok"), data }),
    v.object({ status: v.literal("error") }),
  ]);

export type Result<TData> =
  | { readonly status: "ok"; readonly data: TData }
  | { readonly status: "error" };

export const FAILED = { status: "error" } as const;

export const ForecastResponseSchema = v.object({
  location: LocationSchema,
  parts: v.object({
    current: v.optional(resultSchema(CurrentWeatherSchema)),
    hourly: v.optional(resultSchema(HourlyForecastSchema)),
    daily: v.optional(resultSchema(DailyForecastSchema)),
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

export const LOCALES = ["en", "nl"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

const LocaleWithFallbackSchema = v.fallback(
  v.picklist(LOCALES),
  DEFAULT_LOCALE,
);

export const parseLocale = (locale: unknown): Locale =>
  v.parse(LocaleWithFallbackSchema, locale);

export const LOCATIONS_PATH = "/locations";
export const MAX_LOCATIONS_FOUND = 5;
export const SEARCH_TERM_MAX_LENGTH = 100;

export const LocationsQuerySchema = v.object({
  name: v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(),
    v.maxLength(SEARCH_TERM_MAX_LENGTH),
  ),
  locale: v.picklist(LOCALES),
});

export type LocationsQuery = v.InferOutput<typeof LocationsQuerySchema>;

const PlaceNameSchema = v.pipe(v.string(), v.nonEmpty());

export const FoundLocationSchema = v.object({
  name: PlaceNameSchema,
  region: v.nullable(PlaceNameSchema),
  country: v.nullable(PlaceNameSchema),
  latitude: coordinate(LATITUDE_RANGE),
  longitude: coordinate(LONGITUDE_RANGE),
});

export type FoundLocation = v.InferOutput<typeof FoundLocationSchema>;

export const LocationsResponseSchema = v.object({
  locations: v.pipe(
    v.array(FoundLocationSchema),
    v.maxLength(MAX_LOCATIONS_FOUND),
  ),
});

export type LocationsResponse = v.InferOutput<typeof LocationsResponseSchema>;
