import type { Condition, Daylight } from "@weather-widget/contract";
import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ICON_SVGS } from "../generated/icon-svgs.ts";
import type { Motion } from "./motion-preference.ts";

type IconMarkup = Readonly<Record<Motion, string>>;

const METEOCONS = ICON_SVGS.meteocons satisfies Record<string, IconMarkup>;

type Meteocon = keyof typeof METEOCONS;

const METEOCON_FOR_CONDITION: Readonly<
  Record<Condition, Readonly<Record<Daylight, Meteocon>>>
> = {
  clear: { day: "clear-day", night: "clear-night" },
  "partly-cloudy": { day: "partly-cloudy-day", night: "partly-cloudy-night" },
  "mostly-cloudy": { day: "overcast-day", night: "overcast-night" },
  overcast: { day: "cloudy", night: "cloudy" },
  fog: { day: "fog-day", night: "fog-night" },
  haze: { day: "haze-day", night: "haze-night" },
  drizzle: { day: "drizzle", night: "drizzle" },
  rain: { day: "rain", night: "rain" },
  sleet: { day: "sleet", night: "sleet" },
  snow: { day: "snow", night: "snow" },
  thunderstorm: { day: "thunderstorms-day", night: "thunderstorms-night" },
  unknown: { day: "not-available", night: "not-available" },
};

export interface ConditionIcon {
  readonly condition: Condition;
  readonly daylight: Daylight;
  readonly motion: Motion;
  readonly placement: string;
}

const ID_SEPARATOR = "__";

const SVG_OPENING = "<svg ";
const HIDDEN_SVG_OPENING = '<svg aria-hidden="true" ';

const svgOf = (meteocon: Meteocon, motion: Motion, placement: string) =>
  unsafeHTML(
    METEOCONS[meteocon][motion]
      .replace(SVG_OPENING, HIDDEN_SVG_OPENING)
      .replaceAll(
        `${meteocon}${ID_SEPARATOR}`,
        `${meteocon}${ID_SEPARATOR}${placement}-`,
      ),
  );

const markupOf = ({ condition, daylight, motion, placement }: ConditionIcon) =>
  svgOf(METEOCON_FOR_CONDITION[condition][daylight], motion, placement);

export const decorativeConditionIcon = (icon: ConditionIcon) =>
  html`<span class="icon">${markupOf(icon)}</span>`;

export const namedConditionIcon = (icon: ConditionIcon, name: string) =>
  html`<span class="icon" role="img" aria-label=${name}
    >${markupOf(icon)}</span
  >`;

export type FactIcon = Extract<Meteocon, "thermometer" | "raindrop">;

const FACT_PLACEMENT = "fact";

export const factIcon = (meteocon: FactIcon, motion: Motion) =>
  html`<span class="icon" aria-hidden="true"
    >${svgOf(meteocon, motion, FACT_PLACEMENT)}</span
  >`;

const COMPASS_CENTRE = "64 64";
const COMPASS_ROTATION = `rotate(0 ${COMPASS_CENTRE})`;
const COMPASS_NEEDLE_OFFSET_DEGREES = 135;
const NEEDLE_SWAY = /<animateTransform[^>]*\/>/;

export const windCompassIcon = (directionDegrees: number, motion: Motion) => {
  const rotation = directionDegrees + COMPASS_NEEDLE_OFFSET_DEGREES;
  const pointed = ICON_SVGS.windCompass
    .replace(SVG_OPENING, HIDDEN_SVG_OPENING)
    .replace(
      `transform="${COMPASS_ROTATION}`,
      `data-needle transform="rotate(${String(rotation)} ${COMPASS_CENTRE})`,
    );
  return html`<span class="icon" aria-hidden="true"
    >${unsafeHTML(motion === "still" ? pointed.replace(NEEDLE_SWAY, "") : pointed)}</span
  >`;
};

export const notAvailableIcon = () =>
  html`<span class="not-available" aria-hidden="true"
    >${unsafeHTML(ICON_SVGS.notAvailableMark.replace(SVG_OPENING, HIDDEN_SVG_OPENING))}</span
  >`;
