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

export const LOCALES = ["en"] as const;

export type Locale = (typeof LOCALES)[number];

export interface Messages {
  readonly loading: string;
  readonly forecastUnavailable: string;
  readonly partUnavailable: Readonly<Record<ForecastPart, string>>;
  readonly forecastFor: (name: string) => string;
  readonly forecastForUpdatedAt: (name: string, time: string) => string;
  readonly tryAgain: string;
  readonly feelsLike: string;
  readonly wind: string;
  readonly chanceOfPrecipitation: string;
  readonly calm: string;
  readonly updatedAt: string;
  readonly weatherDataFrom: string;
  readonly weatherProviderName: string;
  readonly nextHours: string;
  readonly nextDays: string;
  readonly low: string;
  readonly high: string;
  readonly conditions: Readonly<Record<Condition, string>>;
  readonly windFrom: (speed: string, direction: string) => string;
  readonly coordinateHeard: (degrees: string, direction: string) => string;
  readonly compassPointsShown: Readonly<Record<CompassPoint, string>>;
  readonly compassPointsHeard: Readonly<Record<CompassPoint, string>>;
}

const en: Messages = {
  loading: "Loading forecast",
  forecastUnavailable: "Forecast unavailable",
  partUnavailable: {
    current: "Current conditions unavailable",
    hourly: "Hourly forecast unavailable",
    daily: "Daily forecast unavailable",
  },
  forecastFor: (name) => `Forecast for ${name}`,
  forecastForUpdatedAt: (name, time) =>
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
  },
  windFrom: (speed, direction) => `${speed} from the ${direction}`,
  coordinateHeard: (degrees, direction) => `${degrees} degrees ${direction}`,
  compassPointsShown: {
    N: "N",
    NNE: "NNE",
    NE: "NE",
    ENE: "ENE",
    E: "E",
    ESE: "ESE",
    SE: "SE",
    SSE: "SSE",
    S: "S",
    SSW: "SSW",
    SW: "SW",
    WSW: "WSW",
    W: "W",
    WNW: "WNW",
    NW: "NW",
    NNW: "NNW",
  },
  compassPointsHeard: {
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
  },
};

export const MESSAGES: Readonly<Record<Locale, Messages>> = { en };
