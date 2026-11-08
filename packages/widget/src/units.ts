import * as v from "valibot";

export const UNITS = ["metric", "imperial"] as const;

export type Units = (typeof UNITS)[number];

export const DEFAULT_UNITS: Units = "metric";

const UnitsSchema = v.fallback(v.picklist(UNITS), DEFAULT_UNITS);

export const parseUnits = (units: unknown): Units =>
  v.parse(UnitsSchema, units);

const SECONDS_PER_HOUR = 3600;
const METRES_PER_KILOMETRE = 1000;
const METRES_PER_MILE = 1609.344;
const FAHRENHEIT_DEGREES_PER_CELSIUS_DEGREE = 1.8;
const FAHRENHEIT_AT_FREEZING = 32;

interface Measure {
  readonly unit:
    "celsius" | "fahrenheit" | "kilometer-per-hour" | "mile-per-hour";
  readonly fromMetric: (value: number) => number;
}

export const MEASURES: Readonly<
  Record<Units, { readonly temperature: Measure; readonly speed: Measure }>
> = {
  metric: {
    temperature: { unit: "celsius", fromMetric: (celsius) => celsius },
    speed: {
      unit: "kilometer-per-hour",
      fromMetric: (metresPerSecond) =>
        (metresPerSecond * SECONDS_PER_HOUR) / METRES_PER_KILOMETRE,
    },
  },
  imperial: {
    temperature: {
      unit: "fahrenheit",
      fromMetric: (celsius) =>
        celsius * FAHRENHEIT_DEGREES_PER_CELSIUS_DEGREE +
        FAHRENHEIT_AT_FREEZING,
    },
    speed: {
      unit: "mile-per-hour",
      fromMetric: (metresPerSecond) =>
        (metresPerSecond * SECONDS_PER_HOUR) / METRES_PER_MILE,
    },
  },
};
