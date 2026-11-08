import type { Condition, Daylight } from "@weather-widget/contract";
import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import clearDayAnimated from "@meteocons/svg/monochrome/clear-day.svg?raw";
import clearDayStill from "@meteocons/svg-static/monochrome/clear-day.svg?raw";
import clearNightAnimated from "@meteocons/svg/monochrome/clear-night.svg?raw";
import clearNightStill from "@meteocons/svg-static/monochrome/clear-night.svg?raw";
import partlyCloudyDayAnimated from "@meteocons/svg/monochrome/partly-cloudy-day.svg?raw";
import partlyCloudyDayStill from "@meteocons/svg-static/monochrome/partly-cloudy-day.svg?raw";
import partlyCloudyNightAnimated from "@meteocons/svg/monochrome/partly-cloudy-night.svg?raw";
import partlyCloudyNightStill from "@meteocons/svg-static/monochrome/partly-cloudy-night.svg?raw";
import overcastDayAnimated from "@meteocons/svg/monochrome/overcast-day.svg?raw";
import overcastDayStill from "@meteocons/svg-static/monochrome/overcast-day.svg?raw";
import overcastNightAnimated from "@meteocons/svg/monochrome/overcast-night.svg?raw";
import overcastNightStill from "@meteocons/svg-static/monochrome/overcast-night.svg?raw";
import cloudyAnimated from "@meteocons/svg/monochrome/cloudy.svg?raw";
import cloudyStill from "@meteocons/svg-static/monochrome/cloudy.svg?raw";
import fogDayAnimated from "@meteocons/svg/monochrome/fog-day.svg?raw";
import fogDayStill from "@meteocons/svg-static/monochrome/fog-day.svg?raw";
import fogNightAnimated from "@meteocons/svg/monochrome/fog-night.svg?raw";
import fogNightStill from "@meteocons/svg-static/monochrome/fog-night.svg?raw";
import hazeDayAnimated from "@meteocons/svg/monochrome/haze-day.svg?raw";
import hazeDayStill from "@meteocons/svg-static/monochrome/haze-day.svg?raw";
import hazeNightAnimated from "@meteocons/svg/monochrome/haze-night.svg?raw";
import hazeNightStill from "@meteocons/svg-static/monochrome/haze-night.svg?raw";
import drizzleAnimated from "@meteocons/svg/monochrome/drizzle.svg?raw";
import drizzleStill from "@meteocons/svg-static/monochrome/drizzle.svg?raw";
import rainAnimated from "@meteocons/svg/monochrome/rain.svg?raw";
import rainStill from "@meteocons/svg-static/monochrome/rain.svg?raw";
import sleetAnimated from "@meteocons/svg/monochrome/sleet.svg?raw";
import sleetStill from "@meteocons/svg-static/monochrome/sleet.svg?raw";
import snowAnimated from "@meteocons/svg/monochrome/snow.svg?raw";
import snowStill from "@meteocons/svg-static/monochrome/snow.svg?raw";
import thunderstormsDayAnimated from "@meteocons/svg/monochrome/thunderstorms-day.svg?raw";
import thunderstormsDayStill from "@meteocons/svg-static/monochrome/thunderstorms-day.svg?raw";
import thunderstormsNightAnimated from "@meteocons/svg/monochrome/thunderstorms-night.svg?raw";
import thunderstormsNightStill from "@meteocons/svg-static/monochrome/thunderstorms-night.svg?raw";
import notAvailableAnimated from "@meteocons/svg/monochrome/not-available.svg?raw";
import notAvailableStill from "@meteocons/svg-static/monochrome/not-available.svg?raw";
import type { Motion } from "./motion-preference.ts";

type IconMarkup = Readonly<Record<Motion, string>>;

const METEOCONS = {
  "clear-day": { animated: clearDayAnimated, still: clearDayStill },
  "clear-night": { animated: clearNightAnimated, still: clearNightStill },
  "partly-cloudy-day": {
    animated: partlyCloudyDayAnimated,
    still: partlyCloudyDayStill,
  },
  "partly-cloudy-night": {
    animated: partlyCloudyNightAnimated,
    still: partlyCloudyNightStill,
  },
  "overcast-day": { animated: overcastDayAnimated, still: overcastDayStill },
  "overcast-night": {
    animated: overcastNightAnimated,
    still: overcastNightStill,
  },
  cloudy: { animated: cloudyAnimated, still: cloudyStill },
  "fog-day": { animated: fogDayAnimated, still: fogDayStill },
  "fog-night": { animated: fogNightAnimated, still: fogNightStill },
  "haze-day": { animated: hazeDayAnimated, still: hazeDayStill },
  "haze-night": { animated: hazeNightAnimated, still: hazeNightStill },
  drizzle: { animated: drizzleAnimated, still: drizzleStill },
  rain: { animated: rainAnimated, still: rainStill },
  sleet: { animated: sleetAnimated, still: sleetStill },
  snow: { animated: snowAnimated, still: snowStill },
  "thunderstorms-day": {
    animated: thunderstormsDayAnimated,
    still: thunderstormsDayStill,
  },
  "thunderstorms-night": {
    animated: thunderstormsNightAnimated,
    still: thunderstormsNightStill,
  },
  "not-available": { animated: notAvailableAnimated, still: notAvailableStill },
} satisfies Record<string, IconMarkup>;

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

const markupOf = ({
  condition,
  daylight,
  motion,
  placement,
}: ConditionIcon) => {
  const meteocon = METEOCON_FOR_CONDITION[condition][daylight];
  return unsafeHTML(
    METEOCONS[meteocon][motion]
      .replace(SVG_OPENING, HIDDEN_SVG_OPENING)
      .replaceAll(
        `${meteocon}${ID_SEPARATOR}`,
        `${meteocon}${ID_SEPARATOR}${placement}-`,
      ),
  );
};

export const decorativeConditionIcon = (icon: ConditionIcon) =>
  html`<span class="icon">${markupOf(icon)}</span>`;

export const namedConditionIcon = (icon: ConditionIcon, name: string) =>
  html`<span class="icon" role="img" aria-label=${name}
    >${markupOf(icon)}</span
  >`;
