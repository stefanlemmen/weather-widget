import type {
  CurrentConditions,
  DailyForecast,
  ForecastPart,
  HourlyForecast,
  Location,
  Result,
} from "@weather-widget/contract";
import { html, nothing, type TemplateResult } from "lit";
import {
  formatChance,
  formatHour,
  formatTemperature,
  formatTime,
  formatWeekday,
  formatWind,
  type Spoken,
} from "./format.ts";
import type { Forecast } from "./forecast-client.ts";
import { upcomingDays, upcomingHours } from "./forecast-window.ts";
import { MESSAGES } from "./messages.ts";

const OPENWEATHER_URL = "https://openweathermap.org/";

const spoken = (text: Spoken | string) =>
  typeof text === "string"
    ? text
    : html`<span aria-hidden="true">${text.shown}</span
        ><span class="visually-hidden">${text.heard}</span>`;

export const heard = (text: Spoken | string) =>
  typeof text === "string" ? text : text.heard;

const chance = (precipitationChance: number) =>
  html`<span class="visually-hidden">${MESSAGES.chanceOfPrecipitation}</span>
    ${formatChance(precipitationChance)}`;

const shownOrUnavailable = <TData>(
  part: ForecastPart,
  result: Result<TData>,
  show: (data: TData) => TemplateResult,
) =>
  result.status === "ok"
    ? show(result.data)
    : html`<p>${MESSAGES.partUnavailable[part]}</p>`;

const currentConditionsDetails = (current: CurrentConditions) =>
  html`<dl>
    <div>
      <dt>${MESSAGES.feelsLike}</dt>
      <dd>${spoken(formatTemperature(current.feelsLikeCelsius))}</dd>
    </div>
    <div>
      <dt>${MESSAGES.wind}</dt>
      <dd>
        ${spoken(
          formatWind(
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
            <dt>${MESSAGES.chanceOfPrecipitation}</dt>
            <dd>${formatChance(current.precipitationChance)}</dd>
          </div>`
    }
  </dl>`;

const currentConditions = (current: Result<CurrentConditions>) =>
  shownOrUnavailable(
    "current",
    current,
    (conditions) =>
      html`<p class="temperature">
          ${spoken(formatTemperature(conditions.temperatureCelsius))}
        </p>
        ${currentConditionsDetails(conditions)}`,
  );

const hourlyForecast = (
  hourly: Result<HourlyForecast>,
  { timeZone }: Location,
  now: Date,
) =>
  html`<section>
    <h3 id="hourly-heading">${MESSAGES.nextHours}</h3>
    ${shownOrUnavailable(
      "hourly",
      hourly,
      (hours) =>
        html`<ol aria-labelledby="hourly-heading">
          ${upcomingHours(hours, now).map(
            (hour) =>
              html`<li>
                <time datetime=${hour.startsAt}
                  >${formatHour(hour.startsAt, timeZone)}</time
                >
                <span>${MESSAGES.conditions[hour.condition]}</span>
                <span
                  >${spoken(formatTemperature(hour.temperatureCelsius))}</span
                >
                <span>${chance(hour.precipitationChance)}</span>
              </li>`,
          )}
        </ol>`,
    )}
  </section>`;

const dailyForecast = (
  daily: Result<DailyForecast>,
  { timeZone }: Location,
  now: Date,
) =>
  html`<section>
    <h3 id="daily-heading">${MESSAGES.nextDays}</h3>
    ${shownOrUnavailable(
      "daily",
      daily,
      (days) =>
        html`<ol aria-labelledby="daily-heading">
          ${upcomingDays(days, timeZone, now).map(
            (day) =>
              html`<li>
                <abbr title=${formatWeekday(day.date, "long")}
                  >${formatWeekday(day.date, "short")}</abbr
                >
                <span>${MESSAGES.conditions[day.condition]}</span>
                <span
                  ><span class="visually-hidden">${MESSAGES.low}</span>
                  ${spoken(formatTemperature(day.lowCelsius))}</span
                >
                <span
                  ><span class="visually-hidden">${MESSAGES.high}</span>
                  ${spoken(formatTemperature(day.highCelsius))}</span
                >
                <span>${chance(day.precipitationChance)}</span>
              </li>`,
          )}
        </ol>`,
    )}
  </section>`;

export const observedAt = ({ current }: Forecast) =>
  current?.status === "ok" ? current.data.observedAt : undefined;

const footer = (forecast: Forecast) => {
  const observed = observedAt(forecast);
  return html`${
      observed
        ? html`<p>
            ${MESSAGES.updatedAt}
            <time datetime=${observed}
              >${formatTime(observed, forecast.location.timeZone)}</time
            >
          </p>`
        : nothing
    }
    <p>
      ${MESSAGES.weatherDataFrom}
      <a href=${OPENWEATHER_URL}>${MESSAGES.weatherProviderName}</a>
    </p>`;
};

export const forecastView = (forecast: Forecast, name: Spoken | string) => {
  const { current, hourly, daily, location } = forecast;
  const now = new Date();
  return html`<h2 tabindex="-1">${spoken(name)}</h2>
    ${current ? currentConditions(current) : nothing}
    ${hourly ? hourlyForecast(hourly, location, now) : nothing}
    ${daily ? dailyForecast(daily, location, now) : nothing} ${footer(forecast)}`;
};
