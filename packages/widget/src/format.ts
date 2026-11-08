import type { Coordinates } from "@weather-widget/contract";
import {
  COMPASS_POINTS,
  MESSAGES,
  type CardinalPoint,
  type CompassPoint,
  type Locale,
  type Messages,
} from "./messages.ts";
import { MEASURES, type Units } from "./units.ts";

const DEGREES_PER_COMPASS_POINT = 360 / COMPASS_POINTS.length;
const COORDINATE_DECIMALS = 2;
const CALENDAR_TIME_ZONE = "UTC";
const HYPHEN_MINUS = "-";
const MINUS_SIGN = "\u2212";

const HOUR_FORMATS: Readonly<Record<Locale, Intl.DateTimeFormatOptions>> = {
  en: { hour: "numeric" },
  nl: { hour: "2-digit", minute: "2-digit" },
};

export interface Spoken {
  readonly shown: string;
  readonly heard: string;
}

export interface Formatter {
  readonly locale: Locale;
  readonly messages: Messages;
  readonly temperature: (celsius: number) => Spoken;
  readonly wind: (
    metresPerSecond: number,
    directionDegrees: number,
  ) => Spoken | string;
  readonly chance: (chance: number) => string;
  readonly time: (isoTimestamp: string, timeZone: string) => string;
  readonly hour: (isoTimestamp: string, timeZone: string) => string;
  readonly weekday: (isoDate: string, weekday: "short" | "long") => string;
  readonly coordinates: (coordinates: Coordinates) => Spoken;
}

const compassPoint = (degrees: number): CompassPoint =>
  COMPASS_POINTS[
    Math.round(degrees / DEGREES_PER_COMPASS_POINT) % COMPASS_POINTS.length
  ] ?? COMPASS_POINTS[0];

export const formatterFor = (locale: Locale, units: Units): Formatter => {
  const messages = MESSAGES[locale];
  const { temperature, speed } = MEASURES[units];

  const unitFormat = (unit: string, unitDisplay: "short" | "long") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay,
      maximumFractionDigits: 0,
      signDisplay: "negative",
    });

  const temperatureFormat = (unitDisplay: "short" | "long") => {
    const format = unitFormat(temperature.unit, unitDisplay);
    return (value: number) =>
      format.format(value).replace(HYPHEN_MINUS, MINUS_SIGN);
  };

  const temperatureShort = temperatureFormat("short");
  const temperatureLong = temperatureFormat("long");
  const speedShort = unitFormat(speed.unit, "short");
  const speedLong = unitFormat(speed.unit, "long");
  const percentFormat = new Intl.NumberFormat(locale, { style: "percent" });
  const coordinateFormat = new Intl.NumberFormat(locale, {
    minimumFractionDigits: COORDINATE_DECIMALS,
    maximumFractionDigits: COORDINATE_DECIMALS,
  });

  const coordinate = (
    value: number,
    positive: CardinalPoint,
    negative: CardinalPoint,
  ): Spoken => {
    const degrees = coordinateFormat.format(Math.abs(value));
    const point = value < 0 ? negative : positive;
    return {
      shown: `${degrees}° ${messages.compassPointsShown[point]}`,
      heard: messages.coordinateHeard(degrees, point),
    };
  };

  return {
    locale,
    messages,
    temperature: (celsius) => {
      const shownTemperature = temperature.fromMetric(celsius);
      return {
        shown: temperatureShort(shownTemperature),
        heard: temperatureLong(shownTemperature),
      };
    },
    wind: (metresPerSecond, directionDegrees) => {
      const shownSpeed = speed.fromMetric(metresPerSecond);
      if (Math.round(shownSpeed) === 0) return messages.calm;
      const point = compassPoint(directionDegrees);
      return {
        shown: `${speedShort.format(shownSpeed)} ${messages.compassPointsShown[point]}`,
        heard: messages.windFrom(
          speedLong.format(shownSpeed),
          messages.compassPointsHeard[point],
        ),
      };
    },
    chance: (chance) => percentFormat.format(chance),
    time: (isoTimestamp, timeZone) =>
      new Intl.DateTimeFormat(locale, { timeZone, timeStyle: "short" }).format(
        new Date(isoTimestamp),
      ),
    hour: (isoTimestamp, timeZone) =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        ...HOUR_FORMATS[locale],
      }).format(new Date(isoTimestamp)),
    weekday: (isoDate, weekday) =>
      new Intl.DateTimeFormat(locale, {
        timeZone: CALENDAR_TIME_ZONE,
        weekday,
      }).format(new Date(`${isoDate}T00:00:00Z`)),
    coordinates: ({ latitude, longitude }) => {
      const northSouth = coordinate(latitude, "N", "S");
      const eastWest = coordinate(longitude, "E", "W");
      return {
        shown: `${northSouth.shown}, ${eastWest.shown}`,
        heard: `${northSouth.heard}, ${eastWest.heard}`,
      };
    },
  };
};
