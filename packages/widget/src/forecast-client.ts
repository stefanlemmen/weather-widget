import {
  FORECAST_PARTS,
  FORECAST_PARTS_SEPARATOR,
  FORECAST_PATH,
  ForecastResponseSchema,
  type Coordinates,
  type CurrentConditions,
  type DailyForecast,
  type ForecastPart,
  type ForecastPartResult,
  type HourlyForecast,
  type Location,
} from "@weather-widget/contract";
import * as v from "valibot";

const PARTS_ATTRIBUTE_SEPARATOR = /\s+/;

export interface Forecast {
  readonly coordinates: Coordinates;
  readonly location: Location;
  readonly current?: CurrentConditions;
  readonly hourly?: HourlyForecast;
  readonly daily?: DailyForecast;
}

export type ForecastResult =
  ({ readonly status: "ok" } & Forecast) | { readonly status: "error" };

const FAILED: ForecastResult = { status: "error" };

export const requestedParts = (
  parts: string | undefined,
): readonly ForecastPart[] => {
  const named = new Set(parts?.split(PARTS_ATTRIBUTE_SEPARATOR));
  const known = FORECAST_PARTS.filter((part) => named.has(part));
  return known.length === 0 ? FORECAST_PARTS : known;
};

const forecastUrl = (
  proxyUrl: string,
  { latitude, longitude }: Coordinates,
  parts: readonly ForecastPart[],
) => {
  const url = new URL(`${proxyUrl}${FORECAST_PATH}`, document.baseURI);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    parts: parts.join(FORECAST_PARTS_SEPARATOR),
  }).toString();
  return url;
};

const dataOf = <TData>(result: ForecastPartResult<TData> | undefined) =>
  result?.status === "ok" ? result.data : undefined;

export const fetchForecast = async (
  proxyUrl: string,
  coordinates: Coordinates,
  parts: readonly ForecastPart[],
  signal: AbortSignal,
): Promise<ForecastResult> => {
  try {
    const response = await fetch(forecastUrl(proxyUrl, coordinates, parts), {
      signal,
    });
    if (!response.ok) return FAILED;
    const forecast = v.safeParse(ForecastResponseSchema, await response.json());
    if (!forecast.success) return FAILED;

    const received = forecast.output.parts;
    if (parts.some((part) => received[part]?.status !== "ok")) {
      return FAILED;
    }
    const current = parts.includes("current") && dataOf(received.current);
    const hourly = parts.includes("hourly") && dataOf(received.hourly);
    const daily = parts.includes("daily") && dataOf(received.daily);
    return {
      status: "ok",
      coordinates,
      location: forecast.output.location,
      ...(current && { current }),
      ...(hourly && { hourly }),
      ...(daily && { daily }),
    };
  } catch {
    return FAILED;
  }
};
