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
import {
  decorativeConditionIcon,
  namedConditionIcon,
} from "./condition-icon.ts";
import type { Formatter, Spoken } from "./format.ts";
import type { Forecast } from "./forecast-client.ts";
import type { ForecastState, ShownForecast } from "./forecast-loader.ts";
import { upcomingDays, upcomingHours } from "./forecast-window.ts";
import type { Motion } from "./motion-preference.ts";

const OPENWEATHER_URL = "https://openweathermap.org/";
const ANNOUNCEMENT_SEPARATOR = ". ";

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

const chance = (format: Formatter, precipitationChance: number) =>
  html`<span class="visually-hidden"
      >${format.messages.chanceOfPrecipitation}</span
    >
    ${format.chance(precipitationChance)}`;

const shownOrUnavailable = <TData>(
  format: Formatter,
  part: ForecastPart,
  result: Result<TData>,
  show: (data: TData) => TemplateResult,
) =>
  result.status === "ok"
    ? show(result.data)
    : html`<p>${format.messages.partUnavailable[part]}</p>`;

const currentConditionsDetails = (
  format: Formatter,
  current: CurrentConditions,
) =>
  html`<dl>
    <div>
      <dt>${format.messages.feelsLike}</dt>
      <dd>${spoken(format.temperature(current.feelsLikeCelsius))}</dd>
    </div>
    <div>
      <dt>${format.messages.wind}</dt>
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
        : html`<div>
            <dt>${format.messages.chanceOfPrecipitation}</dt>
            <dd>${format.chance(current.precipitationChance)}</dd>
          </div>`
    }
  </dl>`;

const currentConditions = (
  { format, motion }: ViewContext,
  current: Result<CurrentConditions>,
) =>
  shownOrUnavailable(
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
        ${currentConditionsDetails(format, conditions)}`,
  );

const hourlyForecast = (
  { format, motion }: ViewContext,
  hourly: Result<HourlyForecast>,
  { timeZone }: Location,
  now: Date,
) =>
  html`<section class="hourly">
    <h3 id="hourly-heading">${format.messages.nextHours}</h3>
    ${shownOrUnavailable(
      format,
      "hourly",
      hourly,
      (hours) =>
        html`<ol aria-labelledby="hourly-heading">
          ${upcomingHours(hours, now).map(
            (hour, index) =>
              html`<li>
                <time datetime=${hour.startsAt}
                  >${format.hour(hour.startsAt, timeZone)}</time
                >
                ${namedConditionIcon(
                  { ...hour, motion, placement: `hour-${String(index)}` },
                  format.messages.conditions[hour.condition],
                )}
                <span
                  >${spoken(format.temperature(hour.temperatureCelsius))}</span
                >
                <span>${chance(format, hour.precipitationChance)}</span>
              </li>`,
          )}
        </ol>`,
    )}
  </section>`;

const dailyForecast = (
  { format, motion }: ViewContext,
  daily: Result<DailyForecast>,
  { timeZone }: Location,
  now: Date,
) =>
  html`<section class="daily">
    <h3 id="daily-heading">${format.messages.nextDays}</h3>
    ${shownOrUnavailable(
      format,
      "daily",
      daily,
      (days) =>
        html`<ol aria-labelledby="daily-heading">
          ${upcomingDays(days, timeZone, now).map(
            (day, index) =>
              html`<li>
                <abbr title=${format.weekday(day.date, "long")}
                  >${format.weekday(day.date, "short")}</abbr
                >
                ${namedConditionIcon(
                  {
                    condition: day.condition,
                    daylight: DAY,
                    motion,
                    placement: `day-${String(index)}`,
                  },
                  format.messages.conditions[day.condition],
                )}
                <span
                  ><span class="visually-hidden">${format.messages.low}</span>
                  ${spoken(format.temperature(day.lowCelsius))}</span
                >
                <span
                  ><span class="visually-hidden">${format.messages.high}</span>
                  ${spoken(format.temperature(day.highCelsius))}</span
                >
                <span>${chance(format, day.precipitationChance)}</span>
              </li>`,
          )}
        </ol>`,
    )}
  </section>`;

const observedAt = ({ current }: Forecast) =>
  current?.status === "ok" ? current.data.observedAt : undefined;

const footer = (format: Formatter, forecast: Forecast) => {
  const observed = observedAt(forecast);
  return html`${
      observed
        ? html`<p>
            ${format.messages.updatedAt}
            <time datetime=${observed}
              >${format.time(observed, forecast.location.timeZone)}</time
            >
          </p>`
        : nothing
    }
    <p>
      ${format.messages.weatherDataFrom}
      <a href=${OPENWEATHER_URL}>${format.messages.weatherProviderName}</a>
    </p>`;
};

export const forecastView = (
  context: ViewContext,
  forecast: Forecast,
  name: Spoken | string,
) => {
  const { current, hourly, daily, location } = forecast;
  const now = new Date();
  return html`<h2 tabindex="-1">${spoken(name)}</h2>
    ${current ? currentConditions(context, current) : nothing}
    ${hourly ? hourlyForecast(context, hourly, location, now) : nothing}
    ${daily ? dailyForecast(context, daily, location, now) : nothing}
    ${footer(context.format, forecast)}`;
};

const shownForecastAnnouncement = (
  format: Formatter,
  forecast: ShownForecast,
  name: Spoken | string,
) => {
  const observed = observedAt(forecast);
  const headline = observed
    ? format.messages.forecastForUpdatedAt(
        heard(name),
        format.time(observed, forecast.location.timeZone),
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
