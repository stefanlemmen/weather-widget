import {
  CoordinatesSchema,
  FORECAST_PARTS,
  PROXY_BASE_PATH,
} from "@weather-widget/contract";
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import * as v from "valibot";
import { formatCoordinates, formatTime, type Spoken } from "./format.ts";
import {
  fetchForecast,
  requestedParts,
  type Forecast,
} from "./forecast-client.ts";
import { forecastView, heard, observedAt } from "./forecast-view.ts";
import { MESSAGES } from "./messages.ts";

export const WEATHER_WIDGET_TAG = "weather-widget";
type ShownForecast = Forecast & {
  readonly status: "ok";
  readonly nameTakesFocus: boolean;
};

type FetchingState =
  { readonly status: "loading" } | { readonly status: "retrying" };

type ForecastState =
  | FetchingState
  | ShownForecast
  | { readonly status: "error" }
  | { readonly status: "invalid-location" };

const LOADING: FetchingState = { status: "loading" };
const RETRYING: FetchingState = { status: "retrying" };
const INVALID_LOCATION: ForecastState = { status: "invalid-location" };

const nonBlank = (text: string | undefined) => {
  const trimmed = text?.trim();
  return trimmed === "" ? undefined : trimmed;
};

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
        return forecastView(this.forecast, this.#locationName(this.forecast));
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
