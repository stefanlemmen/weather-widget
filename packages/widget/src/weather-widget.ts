import {
  CoordinatesSchema,
  FORECAST_PARTS,
  PROXY_BASE_PATH,
  type CurrentConditions,
  type DailyForecast,
  type ForecastPart,
  type ForecastPartResult,
  type HourlyForecast,
  type Location,
} from "@weather-widget/contract";
import {
  css,
  html,
  LitElement,
  nothing,
  type PropertyValues,
  type TemplateResult,
} from "lit";
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
  fetchForecast,
  requestedParts,
  type Forecast,
  type ForecastResult,
} from "./forecast-client.ts";
import { upcomingDays, upcomingHours } from "./forecast-window.ts";
import { MESSAGES } from "./messages.ts";

export const WEATHER_WIDGET_TAG = "weather-widget";
type ShownForecast = Extract<ForecastResult, { readonly status: "ok" }> & {
  readonly nameTakesFocus: boolean;
};

type ForecastState =
  | { readonly status: "loading" }
  | { readonly status: "retrying" }
  | ShownForecast
  | Exclude<ForecastResult, { readonly status: "ok" }>
  | { readonly status: "invalid-location" };

type FetchingState = Extract<
  ForecastState,
  { readonly status: "loading" | "retrying" }
>;

const LOADING: FetchingState = { status: "loading" };
const RETRYING: FetchingState = { status: "retrying" };
const INVALID_LOCATION: ForecastState = { status: "invalid-location" };

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

const chance = (precipitationChance: number) =>
  html`<span class="visually-hidden">${MESSAGES.chanceOfPrecipitation}</span>
    ${formatChance(precipitationChance)}`;

const shownOrUnavailable = <TData>(
  part: ForecastPart,
  result: ForecastPartResult<TData>,
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

const currentConditions = (current: ForecastPartResult<CurrentConditions>) =>
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
  hourly: ForecastPartResult<HourlyForecast>,
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
  daily: ForecastPartResult<DailyForecast>,
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

const observedAt = ({ current }: Forecast) =>
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

const heard = (text: Spoken | string) =>
  typeof text === "string" ? text : text.heard;

const ANNOUNCEMENT_SEPARATOR = ". ";

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

  async #load(fetching: FetchingState = LOADING) {
    this.#inFlight?.abort();
    const location = v.safeParse(CoordinatesSchema, {
      latitude: this.latitude,
      longitude: this.longitude,
    });
    if (!location.success) {
      this.forecast = INVALID_LOCATION;
      return;
    }

    this.forecast = fetching;
    const request = new AbortController();
    this.#inFlight = request;
    const forecast = await fetchForecast(
      this.proxyUrl,
      location.output,
      requestedParts(this.parts),
      request.signal,
    );
    if (request.signal.aborted) return;
    this.forecast =
      forecast.status === "ok"
        ? {
            ...forecast,
            nameTakesFocus:
              fetching === RETRYING && this.shadowRoot?.activeElement != null,
          }
        : forecast;
  }

  protected override updated(changed: PropertyValues) {
    if (
      changed.has("forecast") &&
      this.forecast.status === "ok" &&
      this.forecast.nameTakesFocus
    ) {
      this.renderRoot.querySelector("h2")?.focus();
    }
  }

  #retry() {
    if (this.forecast.status === "retrying") return;
    void this.#load(RETRYING);
  }

  #locationName({ coordinates, location }: Forecast): Spoken | string {
    return (
      nonBlank(this.locationName) ??
      location.name ??
      formatCoordinates(coordinates)
    );
  }

  #forecast(forecast: Forecast) {
    const { current, hourly, daily, location } = forecast;
    const now = new Date();
    return html`<h2 tabindex="-1">${spoken(this.#locationName(forecast))}</h2>
      ${current ? currentConditions(current) : nothing}
      ${hourly ? hourlyForecast(hourly, location, now) : nothing}
      ${daily ? dailyForecast(daily, location, now) : nothing}
      ${footer(forecast)}`;
  }

  #forecastAnnouncement(forecast: ShownForecast) {
    const observed = observedAt(forecast);
    const name = heard(this.#locationName(forecast));
    const headline = observed
      ? MESSAGES.forecastForUpdatedAt(
          name,
          formatTime(observed, forecast.location.timeZone),
        )
      : MESSAGES.forecastFor(name);
    const failedParts = FORECAST_PARTS.filter(
      (part) => forecast[part]?.status === "error",
    ).map((part) => MESSAGES.partUnavailable[part]);
    return [
      ...(forecast.nameTakesFocus ? [] : [headline]),
      ...failedParts,
    ].join(ANNOUNCEMENT_SEPARATOR);
  }

  #announcement() {
    switch (this.forecast.status) {
      case "loading":
      case "retrying":
        return MESSAGES.loading;
      case "ok":
        return this.#forecastAnnouncement(this.forecast);
      case "error":
      case "invalid-location":
        return MESSAGES.forecastUnavailable;
    }
  }

  #content() {
    switch (this.forecast.status) {
      case "loading":
        return nothing;
      case "ok":
        return this.#forecast(this.forecast);
      case "error":
      case "retrying":
        return html`<p>${MESSAGES.forecastUnavailable}</p>
          <button
            type="button"
            aria-disabled=${this.forecast.status === "retrying"}
            @click=${() => {
              this.#retry();
            }}
          >
            ${MESSAGES.tryAgain}
          </button>`;
      case "invalid-location":
        return html`<p>${MESSAGES.forecastUnavailable}</p>`;
    }
  }

  protected override render() {
    return html`<div role="status" class="visually-hidden">
        ${this.#announcement()}
      </div>
      ${this.#content()}`;
  }
}
