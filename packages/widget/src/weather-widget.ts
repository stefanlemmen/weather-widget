import {
  FORECAST_PATH,
  ForecastResponseSchema,
  PROXY_BASE_PATH,
} from "@weather-widget/forecast-contract";
import { css, html, LitElement, type PropertyValues } from "lit";
import * as v from "valibot";
import { MESSAGES } from "./messages.ts";

export const WEATHER_WIDGET_TAG = "weather-widget";
const LOCALE = "en";

type ForecastState =
  | { readonly status: "loading" }
  | { readonly status: "ok"; readonly temperatureCelsius: number }
  | { readonly status: "error" };

const LOADING: ForecastState = { status: "loading" };
const FAILED: ForecastState = { status: "error" };

const temperatureFormat = new Intl.NumberFormat(LOCALE, {
  style: "unit",
  unit: "celsius",
  maximumFractionDigits: 0,
  signDisplay: "negative",
});

const forecastUrl = (apiBase: string, latitude: number, longitude: number) => {
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

const isCoordinate = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value);

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

    .temperature {
      margin: 0;
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
    this.forecast = LOADING;
    const { latitude, longitude } = this;
    if (!isCoordinate(latitude) || !isCoordinate(longitude)) return;

    const request = new AbortController();
    this.#inFlight = request;
    const forecast = await fetchForecast(
      forecastUrl(this.apiBase, latitude, longitude),
      request.signal,
    );
    if (!request.signal.aborted) this.forecast = forecast;
  }

  protected override render() {
    switch (this.forecast.status) {
      case "loading":
        return html`<p role="status">${MESSAGES.loading}</p>`;
      case "ok":
        return html`<p class="temperature">
          ${temperatureFormat.format(this.forecast.temperatureCelsius)}
        </p>`;
      case "error":
        return html`<p>${MESSAGES.forecastUnavailable}</p>
          <button type="button" @click=${() => void this.#load()}>
            ${MESSAGES.tryAgain}
          </button>`;
    }
  }
}
