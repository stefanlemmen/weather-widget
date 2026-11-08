import {
  DAY,
  type CurrentConditions,
  type Day,
  type ForecastPart,
  type Hour,
  type Location,
} from "@weather-widget/contract";
import type { Forecast } from "./forecast-client.ts";
import { DAYS_SHOWN, HOURS_SHOWN } from "./forecast-window.ts";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;
const ISO_DATE_LENGTH = "YYYY-MM-DD".length;

const PLACEHOLDER_LOCATION: Location = {
  name: "Nieuwegein",
  timeZone: "UTC",
};

const placeholderConditions = (now: Date): CurrentConditions => ({
  condition: "partly-cloudy",
  timeOfDay: DAY,
  temperatureCelsius: 12,
  feelsLikeCelsius: 10,
  windSpeedMetresPerSecond: 4,
  windDirectionDegrees: 225,
  precipitationChance: 0.4,
  observedAt: now.toISOString(),
});

const placeholderHours = (now: Date): Hour[] => {
  const hourUnderWay =
    Math.floor(now.getTime() / MILLISECONDS_PER_HOUR) * MILLISECONDS_PER_HOUR;
  return Array.from({ length: HOURS_SHOWN }, (_, index) => ({
    startsAt: new Date(
      hourUnderWay + index * MILLISECONDS_PER_HOUR,
    ).toISOString(),
    condition: "partly-cloudy",
    timeOfDay: DAY,
    temperatureCelsius: 12,
    precipitationChance: 0.4,
  }));
};

const placeholderDays = (now: Date): Day[] =>
  Array.from({ length: DAYS_SHOWN }, (_, index) => ({
    date: new Date(now.getTime() + index * MILLISECONDS_PER_DAY)
      .toISOString()
      .slice(0, ISO_DATE_LENGTH),
    condition: "partly-cloudy",
    lowCelsius: 8,
    highCelsius: 14,
    precipitationChance: 0.4,
  }));

export const placeholderForecast = (
  parts: readonly ForecastPart[],
  now: Date,
): Forecast => ({
  coordinates: { latitude: 0, longitude: 0 },
  location: PLACEHOLDER_LOCATION,
  ...(parts.includes("current") && {
    current: { status: "ok", data: placeholderConditions(now) },
  }),
  ...(parts.includes("hourly") && {
    hourly: { status: "ok", data: placeholderHours(now) },
  }),
  ...(parts.includes("daily") && {
    daily: { status: "ok", data: placeholderDays(now) },
  }),
});
