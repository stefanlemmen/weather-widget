import {
  CoordinatesSchema,
  FORECAST_PATH,
  ForecastResponseSchema,
  PROXY_BASE_PATH,
  type Coordinates,
  type CurrentConditions,
  type Location,
} from "@weather-widget/contract";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import * as v from "valibot";
import {
  formatChance,
  formatCoordinates,
  formatTemperature,
  formatTime,
  formatWind,
  type Spoken,
} from "./format.ts";
import { MESSAGES } from "./messages.ts";

export const WEATHER_WIDGET_TAG = "weather-widget";
type ForecastState =
  | { readonly status: "loading" }
  | {
      readonly status: "ok";
      readonly coordinates: Coordinates;
      readonly location: Location;
      readonly current: CurrentConditions;
    }
  | { readonly status: "error" }
  | { readonly status: "invalid-location" };

const LOADING: ForecastState = { status: "loading" };
const FAILED: ForecastState = { status: "error" };
const INVALID_LOCATION: ForecastState = { status: "invalid-location" };

const forecastUrl = (
  proxyUrl: string,
  { latitude, longitude }: Coordinates,
) => {
  const url = new URL(`${proxyUrl}${FORECAST_PATH}`, document.baseURI);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
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

const currentConditionsDetails = ({ location, current }: ShownForecast) =>
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
    </dl>
    <p>
      ${MESSAGES.updatedAt}
      <time datetime=${current.observedAt}
        >${formatTime(current.observedAt, location.timeZone)}</time
      >
    </p>
    <p>
      ${MESSAGES.weatherDataFrom}
      <a href=${OPENWEATHER_URL}>${MESSAGES.weatherProviderName}</a>
    </p>`;

const fetchForecast = async (
  proxyUrl: string,
  coordinates: Coordinates,
  signal: AbortSignal,
): Promise<ForecastState> => {
  try {
    const response = await fetch(forecastUrl(proxyUrl, coordinates), {
      signal,
    });
    if (!response.ok) return FAILED;
    const forecast = v.safeParse(ForecastResponseSchema, await response.json());
    if (!forecast.success) return FAILED;
    const { current } = forecast.output.parts;
    return current.status === "ok"
      ? {
          status: "ok",
          coordinates,
          location: forecast.output.location,
          current: current.data,
        }
      : FAILED;
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
      changed.has("proxyUrl")
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

  #announcement() {
    switch (this.forecast.status) {
      case "loading":
        return MESSAGES.loading;
      case "ok":
        return html`<h2>${this.#locationName(this.forecast)}</h2>
          <p class="temperature">
            ${spoken(formatTemperature(this.forecast.current.temperatureCelsius))}
          </p>`;
      case "error":
      case "invalid-location":
        return MESSAGES.forecastUnavailable;
    }
  }

  protected override render() {
    return html`<div role="status">${this.#announcement()}</div>
      ${
        this.forecast.status === "ok"
          ? currentConditionsDetails(this.forecast)
          : nothing
      }
      ${
        this.forecast.status === "error"
          ? html`<button type="button" @click=${() => void this.#load()}>
              ${MESSAGES.tryAgain}
            </button>`
          : nothing
      }`;
  }
}
