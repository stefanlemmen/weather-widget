import * as v from "valibot";

export const HealthResponseSchema = v.object({
  status: v.literal("ok"),
});

export type HealthResponse = v.InferOutput<typeof HealthResponseSchema>;

export const PROXY_BASE_PATH = "/api";
export const FORECAST_PATH = "/forecast";

export const LATITUDE_RANGE = { min: -90, max: 90 } as const;
export const LONGITUDE_RANGE = { min: -180, max: 180 } as const;

const coordinate = (range: { readonly min: number; readonly max: number }) =>
  v.pipe(
    v.string(),
    v.trim(),
    v.nonEmpty(),
    v.toNumber(),
    v.finite(),
    v.minValue(range.min),
    v.maxValue(range.max),
  );

export const ForecastQuerySchema = v.object({
  latitude: coordinate(LATITUDE_RANGE),
  longitude: coordinate(LONGITUDE_RANGE),
});

export type ForecastQuery = v.InferOutput<typeof ForecastQuerySchema>;

export const CurrentConditionsSchema = v.object({
  temperatureCelsius: v.number(),
});

export type CurrentConditions = v.InferOutput<typeof CurrentConditionsSchema>;

const forecastPartResult = <TData extends v.GenericSchema>(data: TData) =>
  v.variant("status", [
    v.object({ status: v.literal("ok"), data }),
    v.object({ status: v.literal("error") }),
  ]);

export const ForecastResponseSchema = v.object({
  parts: v.object({
    current: forecastPartResult(CurrentConditionsSchema),
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
