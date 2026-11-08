import type { Coordinates } from "@weather-widget/contract";
import {
  COMPASS_POINTS,
  MESSAGES,
  type CompassPoint,
  type Locale,
  type Messages,
} from "./messages.ts";

const KILOMETRES_PER_HOUR_PER_METRE_PER_SECOND = 3.6;
const DEGREES_PER_COMPASS_POINT = 360 / COMPASS_POINTS.length;
const COORDINATE_DECIMALS = 2;
const CALENDAR_TIME_ZONE = "UTC";

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

export const formatterFor = (locale: Locale): Formatter => {
  const messages = MESSAGES[locale];

  const unitFormat = (unit: string, unitDisplay: "short" | "long") =>
    new Intl.NumberFormat(locale, {
      style: "unit",
      unit,
      unitDisplay,
      maximumFractionDigits: 0,
      signDisplay: "negative",
    });

  const celsiusShort = unitFormat("celsius", "short");
  const celsiusLong = unitFormat("celsius", "long");
  const kilometresPerHourShort = unitFormat("kilometer-per-hour", "short");
  const kilometresPerHourLong = unitFormat("kilometer-per-hour", "long");
  const percentFormat = new Intl.NumberFormat(locale, { style: "percent" });
  const coordinateFormat = new Intl.NumberFormat(locale, {
    minimumFractionDigits: COORDINATE_DECIMALS,
    maximumFractionDigits: COORDINATE_DECIMALS,
  });

  const coordinate = (
    value: number,
    positive: CompassPoint,
    negative: CompassPoint,
  ): Spoken => {
    const degrees = coordinateFormat.format(Math.abs(value));
    const point = value < 0 ? negative : positive;
    return {
      shown: `${degrees}° ${messages.compassPointsShown[point]}`,
      heard: messages.coordinateHeard(
        degrees,
        messages.compassPointsHeard[point],
      ),
    };
  };

  return {
    locale,
    messages,
    temperature: (celsius) => ({
      shown: celsiusShort.format(celsius),
      heard: celsiusLong.format(celsius),
    }),
    wind: (metresPerSecond, directionDegrees) => {
      const kilometresPerHour =
        metresPerSecond * KILOMETRES_PER_HOUR_PER_METRE_PER_SECOND;
      if (Math.round(kilometresPerHour) === 0) return messages.calm;
      const point = compassPoint(directionDegrees);
      return {
        shown: `${kilometresPerHourShort.format(kilometresPerHour)} ${messages.compassPointsShown[point]}`,
        heard: messages.windFrom(
          kilometresPerHourLong.format(kilometresPerHour),
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
      new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric" }).format(
        new Date(isoTimestamp),
      ),
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
