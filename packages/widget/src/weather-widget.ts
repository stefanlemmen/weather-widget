import {
  CoordinatesSchema,
  FORECAST_PARTS_SEPARATOR,
  FORECAST_PATH,
  ForecastResponseSchema,
  PROXY_BASE_PATH,
  type Coordinates,
  type CurrentConditions,
  type DailyForecast,
  type ForecastPart,
  type ForecastPartResult,
  type HourlyForecast,
  type Location,
} from "@weather-widget/contract";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import * as v from "valibot";
import {
  formatChance,
  formatCoordinates,
  formatHour,
  formatTemperature,
  formatTime,
  formatWeekday,
  formatWind,
  type Spoken,
} from "./format.ts";
import {
  requestedParts,
  upcomingDays,
  upcomingHours,
} from "./forecast-window.ts";
import { MESSAGES } from "./messages.ts";

export const WEATHER_WIDGET_TAG = "weather-widget";
type ForecastState =
  | { readonly status: "loading" }
  | {
      readonly status: "ok";
      readonly coordinates: Coordinates;
      readonly location: Location;
      readonly current?: CurrentConditions;
      readonly hourly?: HourlyForecast;
      readonly daily?: DailyForecast;
    }
  | { readonly status: "error" }
  | { readonly status: "invalid-location" };

const LOADING: ForecastState = { status: "loading" };
const FAILED: ForecastState = { status: "error" };
const INVALID_LOCATION: ForecastState = { status: "invalid-location" };

const forecastUrl = (
  proxyUrl: string,
  { latitude, longitude }: Coordinates,
  parts: readonly ForecastPart[],
) => {
  const url = new URL(`${proxyUrl}${FORECAST_PATH}`, document.baseURI);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    parts: parts.join(FORECAST_PARTS_SEPARATOR),
  }).toString();
  return url;
};

const OPENWEATHER_URL = "https://openweathermap.org/";

const spoken = (text: Spoken | string) =>
  typeof text === "string"
    ? text
    : html`<span aria-hidden="true">${text.shown}</span
        ><span class="visually-hidden">${text.heard}</span>`;

const nonBlank = (text: string | undefined) => {
  const trimmed = text?.trim();
  return trimmed === "" ? undefined : trimmed;
};

type ShownForecast = Extract<ForecastState, { readonly status: "ok" }>;

const chance = (precipitationChance: number) =>
  html`<span class="visually-hidden">${MESSAGES.chanceOfPrecipitation}</span>
    ${formatChance(precipitationChance)}`;

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
    <div>
      <dt>${MESSAGES.chanceOfPrecipitation}</dt>
      <dd>${formatChance(current.precipitationChance)}</dd>
    </div>
  </dl>`;

const hourlyForecast = (
  hourly: HourlyForecast,
  { timeZone }: Location,
  now: Date,
) =>
  html`<section>
    <h3 id="hourly-heading">${MESSAGES.nextHours}</h3>
    <ol aria-labelledby="hourly-heading">
      ${upcomingHours(hourly, now).map(
        (hour) =>
          html`<li>
            <time datetime=${hour.startsAt}
              >${formatHour(hour.startsAt, timeZone)}</time
            >
            <span>${MESSAGES.conditions[hour.condition]}</span>
            <span>${spoken(formatTemperature(hour.temperatureCelsius))}</span>
            <span>${chance(hour.precipitationChance)}</span>
          </li>`,
      )}
    </ol>
  </section>`;

const dailyForecast = (
  daily: DailyForecast,
  { timeZone }: Location,
  now: Date,
) =>
  html`<section>
    <h3 id="daily-heading">${MESSAGES.nextDays}</h3>
    <ol aria-labelledby="daily-heading">
      ${upcomingDays(daily, timeZone, now).map(
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
    </ol>
  </section>`;

const footer = ({ current, location }: ShownForecast) =>
  html`${
      current
        ? html`<p>
            ${MESSAGES.updatedAt}
            <time datetime=${current.observedAt}
              >${formatTime(current.observedAt, location.timeZone)}</time
            >
          </p>`
        : nothing
    }
    <p>
      ${MESSAGES.weatherDataFrom}
      <a href=${OPENWEATHER_URL}>${MESSAGES.weatherProviderName}</a>
    </p>`;

const fetchForecast = async (
  proxyUrl: string,
  coordinates: Coordinates,
  parts: readonly ForecastPart[],
  signal: AbortSignal,
): Promise<ForecastState> => {
  try {
    const response = await fetch(forecastUrl(proxyUrl, coordinates, parts), {
      signal,
    });
    if (!response.ok) return FAILED;
    const forecast = v.safeParse(ForecastResponseSchema, await response.json());
    if (!forecast.success) return FAILED;
    const received = forecast.output.parts;
    if (parts.some((part) => received[part]?.status !== "ok")) return FAILED;
    const requested = <TData>(
      part: ForecastPart,
      result: ForecastPartResult<TData> | undefined,
    ) =>
      parts.includes(part) && result?.status === "ok" ? result.data : undefined;
    const current = requested("current", received.current);
    const hourly = requested("hourly", received.hourly);
    const daily = requested("daily", received.daily);
    return {
      status: "ok",
      coordinates,
      location: forecast.output.location,
      ...(current && { current }),
      ...(hourly && { hourly }),
      ...(daily && { daily }),
    };
  } catch {
    return FAILED;
  }
};

export class WeatherWidget extends LitElement {
  static override properties = {
    latitude: { type: Number },
    longitude: { type: Number },
    proxyUrl: { type: String, attribute: "proxy-url" },
    locationName: { type: String, attribute: "location-name" },
    parts: { type: String },
    forecast: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
      min-block-size: 6rem;
      font-family: system-ui, sans-serif;
    }

    p,
    h2,
    dl,
    dd {
      margin: 0;
    }

    h2 {
      font-size: 1.25rem;
    }

    .visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .temperature {
      font-size: 3rem;
      font-weight: 600;
      line-height: 1;
    }
  `;

  declare latitude: number | undefined;
  declare longitude: number | undefined;
  declare proxyUrl: string;
  declare locationName: string | undefined;
  declare parts: string | undefined;
  declare private forecast: ForecastState;

  #inFlight: AbortController | undefined;

  constructor() {
    super();
    this.proxyUrl = PROXY_BASE_PATH;
    this.forecast = LOADING;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#inFlight?.abort();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (
      changed.has("latitude") ||
      changed.has("longitude") ||
      changed.has("proxyUrl") ||
      changed.has("parts")
    ) {
      void this.#load();
    }
  }

  async #load() {
    this.#inFlight?.abort();
    const location = v.safeParse(CoordinatesSchema, {
      latitude: this.latitude,
      longitude: this.longitude,
    });
    if (!location.success) {
      this.forecast = INVALID_LOCATION;
      return;
    }

    this.forecast = LOADING;
    const request = new AbortController();
    this.#inFlight = request;
    const forecast = await fetchForecast(
      this.proxyUrl,
      location.output,
      requestedParts(this.parts),
      request.signal,
    );
    if (!request.signal.aborted) this.forecast = forecast;
  }

  #locationName({ coordinates, location }: ShownForecast) {
    return (
      nonBlank(this.locationName) ??
      location.name ??
      spoken(formatCoordinates(coordinates))
    );
  }

  #forecastParts() {
    if (this.forecast.status !== "ok") return nothing;
    const { current, hourly, daily, location } = this.forecast;
    const now = new Date();
    return html`${current ? currentConditionsDetails(current) : nothing}
    ${hourly ? hourlyForecast(hourly, location, now) : nothing}
    ${daily ? dailyForecast(daily, location, now) : nothing}
    ${footer(this.forecast)}`;
  }

  #announcement() {
    switch (this.forecast.status) {
      case "loading":
        return MESSAGES.loading;
      case "ok":
        return html`<h2>${this.#locationName(this.forecast)}</h2>
          ${
            this.forecast.current
              ? html`<p class="temperature">
                  ${spoken(
                    formatTemperature(this.forecast.current.temperatureCelsius),
                  )}
                </p>`
              : nothing
          }`;
      case "error":
      case "invalid-location":
        return MESSAGES.forecastUnavailable;
    }
  }

  protected override render() {
    return html`<div role="status">${this.#announcement()}</div>
      ${this.#forecastParts()}
      ${
        this.forecast.status === "error"
          ? html`<button type="button" @click=${() => void this.#load()}>
              ${MESSAGES.tryAgain}
            </button>`
          : nothing
      }`;
  }
}
