import {
  CoordinatesSchema,
  FORECAST_PATH,
  ForecastResponseSchema,
  PROXY_BASE_PATH,
  type Coordinates,
} from "@weather-widget/contract";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import * as v from "valibot";
import { MESSAGES } from "./messages.ts";

export const WEATHER_WIDGET_TAG = "weather-widget";
const LOCALE = "en";

type ForecastState =
  | { readonly status: "loading" }
  | { readonly status: "ok"; readonly temperatureCelsius: number }
  | { readonly status: "error" }
  | { readonly status: "invalid-location" };

const LOADING: ForecastState = { status: "loading" };
const FAILED: ForecastState = { status: "error" };
const INVALID_LOCATION: ForecastState = { status: "invalid-location" };

const temperatureFormat = new Intl.NumberFormat(LOCALE, {
  style: "unit",
  unit: "celsius",
  maximumFractionDigits: 0,
  signDisplay: "negative",
});

const forecastUrl = (apiBase: string, { latitude, longitude }: Coordinates) => {
  const url = new URL(`${apiBase}${FORECAST_PATH}`, document.baseURI);
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  }).toString();
  return url;
};

const fetchForecast = async (
  url: URL,
  signal: AbortSignal,
): Promise<ForecastState> => {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return FAILED;
    const forecast = v.safeParse(ForecastResponseSchema, await response.json());
    if (!forecast.success) return FAILED;
    const { current } = forecast.output.parts;
    return current.status === "ok"
      ? { status: "ok", temperatureCelsius: current.data.temperatureCelsius }
      : FAILED;
  } catch {
    return FAILED;
  }
};

export class WeatherWidget extends LitElement {
  static override properties = {
    latitude: { type: Number },
    longitude: { type: Number },
    apiBase: { type: String, attribute: "api-base" },
    forecast: { state: true },
  };

  static override styles = css`
    :host {
      display: block;
      min-block-size: 6rem;
      font-family: system-ui, sans-serif;
    }

    p {
      margin: 0;
    }

    .temperature {
      font-size: 3rem;
      font-weight: 600;
      line-height: 1;
    }
  `;

  declare latitude: number | undefined;
  declare longitude: number | undefined;
  declare apiBase: string;
  declare private forecast: ForecastState;

  #inFlight: AbortController | undefined;

  constructor() {
    super();
    this.apiBase = PROXY_BASE_PATH;
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
      changed.has("apiBase")
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
      forecastUrl(this.apiBase, location.output),
      request.signal,
    );
    if (!request.signal.aborted) this.forecast = forecast;
  }

  #announcement() {
    switch (this.forecast.status) {
      case "loading":
        return MESSAGES.loading;
      case "ok":
        return html`<span class="temperature">
          ${temperatureFormat.format(this.forecast.temperatureCelsius)}
        </span>`;
      case "error":
      case "invalid-location":
        return MESSAGES.forecastUnavailable;
    }
  }

  protected override render() {
    return html`<p role="status">${this.#announcement()}</p>
      ${
        this.forecast.status === "error"
          ? html`<button type="button" @click=${() => void this.#load()}>
              ${MESSAGES.tryAgain}
            </button>`
          : nothing
      }`;
  }
}
