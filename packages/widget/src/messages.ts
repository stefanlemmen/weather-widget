import type { Condition, ForecastPart } from "@weather-widget/contract";
import { DAYS_SHOWN, HOURS_SHOWN } from "./forecast-window.ts";

export const COMPASS_POINTS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export type CompassPoint = (typeof COMPASS_POINTS)[number];

export const MESSAGES = {
  loading: "Loading forecast",
  forecastUnavailable: "Forecast unavailable",
  partUnavailable: {
    current: "Current conditions unavailable",
    hourly: "Hourly forecast unavailable",
    daily: "Daily forecast unavailable",
  } satisfies Record<ForecastPart, string>,
  forecastFor: (name: string) => `Forecast for ${name}`,
  forecastForUpdatedAt: (name: string, time: string) =>
    `Forecast for ${name}, updated at ${time}`,
  tryAgain: "Try again",
  feelsLike: "Feels like",
  wind: "Wind",
  chanceOfPrecipitation: "Chance of precipitation",
  calm: "Calm",
  updatedAt: "Updated at",
  weatherDataFrom: "Weather data from",
  weatherProviderName: "OpenWeather",
  nextHours: `Next ${String(HOURS_SHOWN)} hours`,
  nextDays: `Next ${String(DAYS_SHOWN)} days`,
  low: "Low",
  high: "High",
  conditions: {
    clear: "Clear",
    "partly-cloudy": "Partly cloudy",
    "mostly-cloudy": "Mostly cloudy",
    overcast: "Overcast",
    fog: "Fog",
    haze: "Haze",
    drizzle: "Drizzle",
    rain: "Rain",
    sleet: "Sleet",
    snow: "Snow",
    thunderstorm: "Thunderstorm",
    unknown: "Unknown",
  } satisfies Record<Condition, string>,
  windFrom: (speed: string, direction: string) =>
    `${speed} from the ${direction}`,
  coordinateHeard: (degrees: string, direction: string) =>
    `${degrees} degrees ${direction}`,
  compassPoints: {
    N: "north",
    NNE: "north-northeast",
    NE: "northeast",
    ENE: "east-northeast",
    E: "east",
    ESE: "east-southeast",
    SE: "southeast",
    SSE: "south-southeast",
    S: "south",
    SSW: "south-southwest",
    SW: "southwest",
    WSW: "west-southwest",
    W: "west",
    WNW: "west-northwest",
    NW: "northwest",
    NNW: "north-northwest",
  } satisfies Record<CompassPoint, string>,
} as const;
