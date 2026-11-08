import type { Coordinates } from "@weather-widget/contract";
import { COMPASS_POINTS, MESSAGES, type CompassPoint } from "./messages.ts";

const LOCALE = "en";
const KILOMETRES_PER_HOUR_PER_METRE_PER_SECOND = 3.6;
const DEGREES_PER_COMPASS_POINT = 360 / COMPASS_POINTS.length;
const COORDINATE_DECIMALS = 2;

export interface Spoken {
  readonly shown: string;
  readonly heard: string;
}

const unitFormat = (unit: string, unitDisplay: "short" | "long") =>
  new Intl.NumberFormat(LOCALE, {
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

const percentFormat = new Intl.NumberFormat(LOCALE, { style: "percent" });

const coordinateFormat = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: COORDINATE_DECIMALS,
  maximumFractionDigits: COORDINATE_DECIMALS,
});

export const formatTemperature = (celsius: number): Spoken => ({
  shown: celsiusShort.format(celsius),
  heard: celsiusLong.format(celsius),
});

const compassPoint = (degrees: number): CompassPoint =>
  COMPASS_POINTS[
    Math.round(degrees / DEGREES_PER_COMPASS_POINT) % COMPASS_POINTS.length
  ] ?? COMPASS_POINTS[0];

export const formatWind = (
  metresPerSecond: number,
  directionDegrees: number,
): Spoken | typeof MESSAGES.calm => {
  const kilometresPerHour =
    metresPerSecond * KILOMETRES_PER_HOUR_PER_METRE_PER_SECOND;
  if (Math.round(kilometresPerHour) === 0) return MESSAGES.calm;
  const point = compassPoint(directionDegrees);
  return {
    shown: `${kilometresPerHourShort.format(kilometresPerHour)} ${point}`,
    heard: MESSAGES.windFrom(
      kilometresPerHourLong.format(kilometresPerHour),
      MESSAGES.compassPoints[point],
    ),
  };
};

export const formatChance = (chance: number) => percentFormat.format(chance);

export const formatTime = (isoTimestamp: string, timeZone: string) =>
  new Intl.DateTimeFormat(LOCALE, { timeZone, timeStyle: "short" }).format(
    new Date(isoTimestamp),
  );

const formatCoordinate = (
  value: number,
  positive: CompassPoint,
  negative: CompassPoint,
): Spoken => {
  const degrees = coordinateFormat.format(Math.abs(value));
  const point = value < 0 ? negative : positive;
  return {
    shown: `${degrees}° ${point}`,
    heard: MESSAGES.coordinateHeard(degrees, MESSAGES.compassPoints[point]),
  };
};

export const formatCoordinates = ({
  latitude,
  longitude,
}: Coordinates): Spoken => {
  const northSouth = formatCoordinate(latitude, "N", "S");
  const eastWest = formatCoordinate(longitude, "E", "W");
  return {
    shown: `${northSouth.shown}, ${eastWest.shown}`,
    heard: `${northSouth.heard}, ${eastWest.heard}`,
  };
};
