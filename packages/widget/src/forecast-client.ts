import {
  FORECAST_PARTS,
  FORECAST_PARTS_SEPARATOR,
  FORECAST_PATH,
  ForecastResponseSchema,
  type Coordinates,
  type CurrentConditions,
  type DailyForecast,
  type ForecastPart,
  type HourlyForecast,
  type Location,
  type Result,
} from "@weather-widget/contract";
import * as v from "valibot";

const PARTS_ATTRIBUTE_SEPARATOR = /\s+/;

export interface Forecast {
  readonly coordinates: Coordinates;
  readonly location: Location;
  readonly current?: Result<CurrentConditions>;
  readonly hourly?: Result<HourlyForecast>;
  readonly daily?: Result<DailyForecast>;
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

const forecastResponseFor = (parts: readonly ForecastPart[]) =>
  v.pipe(
    ForecastResponseSchema,
    v.check(({ parts: received }) =>
      parts.every((part) => received[part] !== undefined),
    ),
    v.check(({ parts: received }) =>
      parts.some((part) => received[part]?.status === "ok"),
    ),
  );

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
    const forecast = v.safeParse(
      forecastResponseFor(parts),
      await response.json(),
    );
    if (!forecast.success) return FAILED;

    const { current, hourly, daily } = forecast.output.parts;
    return {
      status: "ok",
      coordinates,
      location: forecast.output.location,
      ...(parts.includes("current") && current && { current }),
      ...(parts.includes("hourly") && hourly && { hourly }),
      ...(parts.includes("daily") && daily && { daily }),
    };
  } catch {
    return FAILED;
  }
};

const keptPart = <TData>(
  shown: Result<TData> | undefined,
  fresh: Result<TData> | undefined,
) => (fresh?.status === "error" && shown?.status === "ok" ? shown : fresh);

export const refreshedForecast = (
  shown: Forecast,
  fresh: Forecast,
): Forecast => {
  const current = keptPart(shown.current, fresh.current);
  const hourly = keptPart(shown.hourly, fresh.hourly);
  const daily = keptPart(shown.daily, fresh.daily);
  return {
    ...fresh,
    ...(current && { current }),
    ...(hourly && { hourly }),
    ...(daily && { daily }),
  };
};
