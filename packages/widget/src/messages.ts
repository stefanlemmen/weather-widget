import type { Condition, ForecastPart } from "@weather-widget/contract";
import * as v from "valibot";
import { DAYS_SHOWN, HOURS_SHOWN } from "./forecast-window.ts";

const WEATHER_PROVIDER_CREDIT = "Weather data provided by OpenWeather";

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

export type CardinalPoint = Extract<CompassPoint, "N" | "E" | "S" | "W">;

export const LOCALES = ["en", "nl"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

const LocaleSchema = v.fallback(v.picklist(LOCALES), DEFAULT_LOCALE);

export const parseLocale = (locale: unknown): Locale =>
  v.parse(LocaleSchema, locale);

export interface Messages {
  readonly loading: string;
  readonly forecastUnavailable: string;
  readonly forecastUnavailableExplanation: string;
  readonly currentConditions: string;
  readonly partUnavailable: Readonly<Record<ForecastPart, string>>;
  readonly forecastFor: (name: string) => string;
  readonly forecastForUpdatedAt: (name: string, time: string) => string;
  readonly tryAgain: string;
  readonly feelsLike: string;
  readonly wind: string;
  readonly chanceOfPrecipitation: string;
  readonly calm: string;
  readonly updatedAt: string;
  readonly weatherProviderCredit: string;
  readonly nextHours: string;
  readonly nextDays: string;
  readonly low: string;
  readonly high: string;
  readonly conditions: Readonly<Record<Condition, string>>;
  readonly windFrom: (speed: string, direction: string) => string;
  readonly coordinateHeard: (degrees: string, point: CardinalPoint) => string;
  readonly compassPointsShown: Readonly<Record<CompassPoint, string>>;
  readonly compassPointsHeard: Readonly<Record<CompassPoint, string>>;
}

const ENGLISH_COMPASS_POINTS: Readonly<Record<CompassPoint, string>> = {
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
};

const DUTCH_LATITUDES_AND_LONGITUDES: Readonly<Record<CardinalPoint, string>> =
  {
    N: "noorderbreedte",
    S: "zuiderbreedte",
    E: "oosterlengte",
    W: "westerlengte",
  };

const en: Messages = {
  loading: "Loading forecast",
  forecastUnavailable: "Forecast unavailable",
  forecastUnavailableExplanation:
    "The weather service isn't available right now. Try again in a moment.",
  currentConditions: "Current conditions",
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
  weatherProviderCredit: WEATHER_PROVIDER_CREDIT,
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
  coordinateHeard: (degrees, point) =>
    `${degrees} degrees ${ENGLISH_COMPASS_POINTS[point]}`,
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
  compassPointsHeard: ENGLISH_COMPASS_POINTS,
};

const nl: Messages = {
  loading: "Weersverwachting laden",
  forecastUnavailable: "Weersverwachting niet beschikbaar",
  forecastUnavailableExplanation:
    "De weerdienst is nu niet beschikbaar. Probeer het zo opnieuw.",
  currentConditions: "Huidig weer",
  partUnavailable: {
    current: "Huidig weer niet beschikbaar",
    hourly: "Verwachting per uur niet beschikbaar",
    daily: "Verwachting per dag niet beschikbaar",
  },
  forecastFor: (name) => `Weersverwachting voor ${name}`,
  forecastForUpdatedAt: (name, time) =>
    `Weersverwachting voor ${name}, bijgewerkt om ${time}`,
  tryAgain: "Opnieuw proberen",
  feelsLike: "Gevoelstemperatuur",
  wind: "Wind",
  chanceOfPrecipitation: "Kans op neerslag",
  calm: "Windstil",
  updatedAt: "Bijgewerkt om",
  weatherProviderCredit: WEATHER_PROVIDER_CREDIT,
  nextHours: `Komende ${String(HOURS_SHOWN)} uur`,
  nextDays: `Komende ${String(DAYS_SHOWN)} dagen`,
  low: "Laagste",
  high: "Hoogste",
  conditions: {
    clear: "Helder",
    "partly-cloudy": "Half bewolkt",
    "mostly-cloudy": "Overwegend bewolkt",
    overcast: "Zwaar bewolkt",
    fog: "Mist",
    haze: "Nevel",
    drizzle: "Motregen",
    rain: "Regen",
    sleet: "Natte sneeuw",
    snow: "Sneeuw",
    thunderstorm: "Onweer",
    unknown: "Onbekend",
  },
  windFrom: (speed, direction) => `${speed} uit het ${direction}`,
  coordinateHeard: (degrees, point) =>
    `${degrees} graden ${DUTCH_LATITUDES_AND_LONGITUDES[point]}`,
  compassPointsShown: {
    N: "N",
    NNE: "NNO",
    NE: "NO",
    ENE: "ONO",
    E: "O",
    ESE: "OZO",
    SE: "ZO",
    SSE: "ZZO",
    S: "Z",
    SSW: "ZZW",
    SW: "ZW",
    WSW: "WZW",
    W: "W",
    WNW: "WNW",
    NW: "NW",
    NNW: "NNW",
  },
  compassPointsHeard: {
    N: "noorden",
    NNE: "noordnoordoosten",
    NE: "noordoosten",
    ENE: "oostnoordoosten",
    E: "oosten",
    ESE: "oostzuidoosten",
    SE: "zuidoosten",
    SSE: "zuidzuidoosten",
    S: "zuiden",
    SSW: "zuidzuidwesten",
    SW: "zuidwesten",
    WSW: "westzuidwesten",
    W: "westen",
    WNW: "westnoordwesten",
    NW: "noordwesten",
    NNW: "noordnoordwesten",
  },
};

export const MESSAGES: Readonly<Record<Locale, Messages>> = { en, nl };
