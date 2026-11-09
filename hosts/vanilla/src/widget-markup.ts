import type { LocationSelectDetail } from "@weather-widget/location-picker";

export const LOCALES = ["en", "nl"] as const;
export const UNITS = ["metric", "imperial"] as const;

export type Locale = (typeof LOCALES)[number];
export type Units = (typeof UNITS)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const DEFAULT_UNITS: Units = "metric";

export interface WidgetConfig {
  readonly location: LocationSelectDetail;
  readonly locale: Locale;
  readonly units: Units;
}

export const WIDGET_ATTRIBUTE_NAMES = [
  "latitude",
  "longitude",
  "location-name",
  "locale",
  "units",
] as const;

export type WidgetAttributeName = (typeof WIDGET_ATTRIBUTE_NAMES)[number];

export type WidgetAttributes = ReadonlyMap<WidgetAttributeName, string>;

const presentIn = (
  entries: readonly (readonly [WidgetAttributeName, string | null])[],
): WidgetAttributes =>
  new Map(
    entries.flatMap(([name, value]) =>
      value === null ? [] : [[name, value] as const],
    ),
  );

export const widgetAttributes = ({
  location,
  locale,
  units,
}: WidgetConfig): WidgetAttributes =>
  presentIn([
    ["latitude", String(location.latitude)],
    ["longitude", String(location.longitude)],
    ["location-name", location.name],
    ["locale", locale === DEFAULT_LOCALE ? null : locale],
    ["units", units === DEFAULT_UNITS ? null : units],
  ]);

const escapeAttributeValue = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

export const widgetMarkup = (attributes: WidgetAttributes) =>
  [
    "<weather-widget",
    ...[...attributes].map(
      ([name, value]) => `  ${name}="${escapeAttributeValue(value)}"`,
    ),
    "></weather-widget>",
  ].join("\n");
