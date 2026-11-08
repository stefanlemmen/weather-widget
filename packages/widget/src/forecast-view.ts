import {
  DAY,
  FORECAST_PARTS,
  type CurrentConditions,
  type DailyForecast,
  type ForecastPart,
  type HourlyForecast,
  type Location,
  type Result,
} from "@weather-widget/contract";
import { html, nothing, type TemplateResult } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  decorativeConditionIcon,
  factIcon,
  namedConditionIcon,
  notAvailableIcon,
  windCompassIcon,
} from "./condition-icon.ts";
import type { Formatter, Spoken } from "./format.ts";
import type { Forecast } from "./forecast-client.ts";
import type { ForecastState, ShownForecast } from "./forecast-loader.ts";
import { upcomingDays, upcomingHours } from "./forecast-window.ts";
import type { Motion } from "./motion-preference.ts";

const OPENWEATHER_URL = "https://openweathermap.org/";
const ANNOUNCEMENT_SEPARATOR = ". ";
const CURRENT_HEADING_ID = "current-heading";
const HOURLY_HEADING_ID = "hourly-heading";
const DAILY_HEADING_ID = "daily-heading";
const ERROR_HEADING_ID = "error-heading";

export interface ViewContext {
  readonly format: Formatter;
  readonly motion: Motion;
}

const spoken = (text: Spoken | string) =>
  typeof text === "string"
    ? text
    : html`<span aria-hidden="true">${text.shown}</span
        ><span class="visually-hidden">${text.heard}</span>`;

const heard = (text: Spoken | string) =>
  typeof text === "string" ? text : text.heard;

const PERCENT = 100;

const isDry = (precipitationChance: number) =>
  Math.round(precipitationChance * PERCENT) === 0;

const chance = (format: Formatter, precipitationChance: number) =>
  html`<span
    class=${classMap({ chance: true, dry: isDry(precipitationChance) })}
    ><span class="visually-hidden"
      >${format.messages.chanceOfPrecipitation}</span
    >
    ${format.chance(precipitationChance)}</span
  >`;

const shownOrUnavailable = <TData>(
  format: Formatter,
  part: ForecastPart,
  result: Result<TData>,
  show: (data: TData) => TemplateResult,
) =>
  result.status === "ok"
    ? show(result.data)
    : html`<p class="unavailable">
        ${notAvailableIcon()}${format.messages.partUnavailable[part]}
      </p>`;

const currentConditionsDetails = (
  format: Formatter,
  motion: Motion,
  current: CurrentConditions,
) =>
  html`<dl class="facts">
    <div class="fact">
      <dt>
        ${factIcon("thermometer", motion)}<span
          >${format.messages.feelsLike}</span
        >
      </dt>
      <dd>${spoken(format.temperature(current.feelsLikeCelsius))}</dd>
    </div>
    <div class="fact">
      <dt>
        ${windCompassIcon(current.windDirectionDegrees, motion)}<span
          >${format.messages.wind}</span
        >
      </dt>
      <dd>
        ${spoken(
          format.wind(
            current.windSpeedMetresPerSecond,
            current.windDirectionDegrees,
          ),
        )}
      </dd>
    </div>
    ${
      current.precipitationChance === null
        ? nothing
        : html`<div class="fact">
            <dt>
              ${factIcon("raindrop", motion)}<span
                >${format.messages.chanceOfPrecipitation}</span
              >
            </dt>
            <dd
              class=${classMap({
                rain: !isDry(current.precipitationChance),
              })}
            >
              ${format.chance(current.precipitationChance)}
            </dd>
          </div>`
    }
  </dl>`;

const currentConditions = (
  { format, motion }: ViewContext,
  current: Result<CurrentConditions>,
) =>
  html`<section class="current" aria-labelledby=${CURRENT_HEADING_ID}>
    <h3 class="visually-hidden" id=${CURRENT_HEADING_ID}>
      ${format.messages.currentConditions}
    </h3>
    ${shownOrUnavailable(
      format,
      "current",
      current,
      (conditions) =>
        html`<p class="temperature">
            ${spoken(format.temperature(conditions.temperatureCelsius))}
          </p>
          <p class="condition">
            ${decorativeConditionIcon({
              ...conditions,
              motion,
              placement: "current",
            })}
            <span>${format.messages.conditions[conditions.condition]}</span>
          </p>
          ${currentConditionsDetails(format, motion, conditions)}`,
    )}
  </section>`;

const hourlyForecast = (
  { format, motion }: ViewContext,
  hourly: Result<HourlyForecast>,
  { timeZone }: Location,
  now: Date,
) =>
  html`<section class="hourly" aria-labelledby=${HOURLY_HEADING_ID}>
    <h3 id=${HOURLY_HEADING_ID}>${format.messages.nextHours}</h3>
    ${shownOrUnavailable(
      format,
      "hourly",
      hourly,
      (hours) =>
        html`<ol aria-labelledby=${HOURLY_HEADING_ID}>
          ${upcomingHours(hours, now).map(
            (hour, index) =>
              html`<li class="hour">
                <time datetime=${hour.startsAt}
                  >${format.hour(hour.startsAt, timeZone)}</time
                >
                ${namedConditionIcon(
                  { ...hour, motion, placement: `hour-${String(index)}` },
                  format.messages.conditions[hour.condition],
                )}
                <span class="value"
                  >${spoken(format.temperature(hour.temperatureCelsius))}</span
                >
                ${chance(format, hour.precipitationChance)}
              </li>`,
          )}
        </ol>`,
    )}
  </section>`;

interface Range {
  readonly from: number;
  readonly to: number;
}

const sharedRanges = (days: DailyForecast): Range[] => {
  const lowest = Math.min(...days.map((day) => day.lowCelsius));
  const highest = Math.max(...days.map((day) => day.highCelsius));
  const span = highest - lowest;
  const position = (celsius: number) =>
    span === 0 ? 0 : (celsius - lowest) / span;
  return days.map((day) => ({
    from: position(day.lowCelsius),
    to: span === 0 ? 1 : position(day.highCelsius),
  }));
};

const NARROW_DAY_NAME_LENGTH = 2;

const dayName = (format: Formatter, isoDate: string) => {
  const full = format.weekday(isoDate, "long");
  const short = format.weekday(isoDate, "short");
  return html`<span class="day-name"
    ><abbr class="day-name-narrow" title=${full} aria-hidden="true"
      >${short.slice(0, NARROW_DAY_NAME_LENGTH)}</abbr
    ><abbr class="day-name-short" title=${full} aria-hidden="true"
      >${short}</abbr
    ><span class="day-name-long" aria-hidden="true">${full}</span
    ><span class="visually-hidden">${full}</span></span
  >`;
};

const rangeBar = ({ from, to }: Range) =>
  html`<span class="range" data-range aria-hidden="true"
    ><span
      class="range-fill"
      style=${styleMap({ "--_from": String(from), "--_to": String(to) })}
    ></span
  ></span>`;

const dailyForecast = (
  { format, motion }: ViewContext,
  daily: Result<DailyForecast>,
  { timeZone }: Location,
  now: Date,
) =>
  html`<section class="daily" aria-labelledby=${DAILY_HEADING_ID}>
    <h3 id=${DAILY_HEADING_ID}>${format.messages.nextDays}</h3>
    ${shownOrUnavailable(format, "daily", daily, (days) => {
      const shown = upcomingDays(days, timeZone, now);
      const ranges = sharedRanges(shown);
      return html`<ol aria-labelledby=${DAILY_HEADING_ID}>
        ${shown.map(
          (day, index) =>
            html`<li class="day">
              ${dayName(format, day.date)}
              ${namedConditionIcon(
                {
                  condition: day.condition,
                  daylight: DAY,
                  motion,
                  placement: `day-${String(index)}`,
                },
                format.messages.conditions[day.condition],
              )}
              <span class="low"
                ><span class="visually-hidden">${format.messages.low}</span>
                ${spoken(format.temperature(day.lowCelsius))}</span
              >
              ${ranges[index] ? rangeBar(ranges[index]) : nothing}
              <span class="high"
                ><span class="visually-hidden">${format.messages.high}</span>
                ${spoken(format.temperature(day.highCelsius))}</span
              >
              ${chance(format, day.precipitationChance)}
            </li>`,
        )}
      </ol>`;
    })}
  </section>`;

interface Observed {
  readonly at: string;
  readonly timeZone: string;
}

const observedIn = ({ current, location }: Forecast): Observed | undefined =>
  current?.status === "ok"
    ? { at: current.data.observedAt, timeZone: location.timeZone }
    : undefined;

const footer = (format: Formatter, observed?: Observed) =>
  html`<footer class="credit">
    <p>
      ${
        observed
          ? html`${format.messages.updatedAt}
              <time datetime=${observed.at}
                >${format.time(observed.at, observed.timeZone)}</time
              >
              ·`
          : nothing
      }
      <a href=${OPENWEATHER_URL}>${format.messages.weatherProviderCredit}</a>
    </p>
  </footer>`;

const locationNameHeading = (name: Spoken | string) =>
  html`<h2 tabindex="-1">${spoken(name)}</h2>`;

export const forecastView = (
  context: ViewContext,
  forecast: Forecast,
  name: Spoken | string,
) => {
  const { current, hourly, daily, location } = forecast;
  const now = new Date();
  return html`${locationNameHeading(name)}
  ${current ? currentConditions(context, current) : nothing}
  ${hourly ? hourlyForecast(context, hourly, location, now) : nothing}
  ${daily ? dailyForecast(context, daily, location, now) : nothing}
  ${footer(context.format, observedIn(forecast))}`;
};

export const errorView = (
  format: Formatter,
  name: Spoken | string | undefined,
  tryAgain?: TemplateResult,
) =>
  html`${name === undefined ? nothing : locationNameHeading(name)}
    <section class="error" aria-labelledby=${ERROR_HEADING_ID}>
      ${notAvailableIcon()}
      <h3 id=${ERROR_HEADING_ID}>${format.messages.forecastUnavailable}</h3>
      ${
        tryAgain === undefined
          ? nothing
          : html`<p>${format.messages.forecastUnavailableExplanation}</p>
              ${tryAgain}`
      }
    </section>
    ${footer(format)}`;

const shownForecastAnnouncement = (
  format: Formatter,
  forecast: ShownForecast,
  name: Spoken | string,
) => {
  const observed = observedIn(forecast);
  const headline = observed
    ? format.messages.forecastForUpdatedAt(
        heard(name),
        format.time(observed.at, observed.timeZone),
      )
    : format.messages.forecastFor(heard(name));
  const failedParts = FORECAST_PARTS.filter(
    (part) => forecast[part]?.status === "error",
  ).map((part) => format.messages.partUnavailable[part]);
  return [...(forecast.nameTakesFocus ? [] : [headline]), ...failedParts].join(
    ANNOUNCEMENT_SEPARATOR,
  );
};

export const forecastAnnouncement = (
  format: Formatter,
  announced: ForecastState,
  nameOf: (forecast: Forecast) => Spoken | string,
) => {
  switch (announced.status) {
    case "loading":
    case "retrying":
      return format.messages.loading;
    case "ok":
      return shownForecastAnnouncement(format, announced, nameOf(announced));
    case "error":
    case "invalid-location":
      return format.messages.forecastUnavailable;
  }
};
