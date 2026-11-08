import {
  CoordinatesSchema,
  FORECAST_PARTS,
  PROXY_BASE_PATH,
} from "@weather-widget/contract";
import { css, html, LitElement, type PropertyValues } from "lit";
import * as v from "valibot";
import { formatterFor, type Formatter, type Spoken } from "./format.ts";
import {
  fetchForecast,
  keepsShownParts,
  refreshedForecast,
  requestedParts,
  type Forecast,
} from "./forecast-client.ts";
import { forecastView, heard, observedAt } from "./forecast-view.ts";
import { DEFAULT_LOCALE, parseLocale } from "./messages.ts";
import { MotionPreference, STILL } from "./motion-preference.ts";
import { placeholderForecast } from "./skeleton.ts";
import { DEFAULT_UNITS, parseUnits } from "./units.ts";

export const WEATHER_WIDGET_TAG = "weather-widget";
type ShownForecast = Forecast & {
  readonly status: "ok";
  readonly nameTakesFocus: boolean;
  readonly receivedAt: number;
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
const NEAR_VIEWPORT_MARGIN = "200px";
const FORECAST_MAX_AGE_MILLISECONDS = 10 * 60 * 1000;

export class WeatherWidget extends LitElement {
  static override properties = {
    latitude: { type: Number },
    longitude: { type: Number },
    proxyUrl: { type: String, attribute: "proxy-url" },
    locationName: { type: String, attribute: "location-name" },
    parts: { type: String },
    locale: { type: String },
    units: { type: String },
    forecast: { state: true },
  };

  static override styles = css`
    :host {
      --_ground: light-dark(#eef3f9, #16263b);
      --_ink: light-dark(#13243a, #f2f5f9);
      --_accent: light-dark(#17703f, #6fdc9b);
      --_track: color-mix(in oklab, var(--_ink) 16%, var(--_ground));
      color-scheme: light dark;
      background-color: var(--_ground);
      color: var(--_ink);
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

    a {
      color: var(--_accent);
    }

    .visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .skeleton,
    .skeleton * {
      color: transparent;
      text-decoration: none;
    }

    .skeleton :is(h2, h3, p, dt, dd, li > *, .condition > *) {
      inline-size: fit-content;
      border-radius: 4px;
      background-color: var(--_track);
    }

    .skeleton .condition {
      background-color: transparent;
    }

    @media (prefers-reduced-motion: no-preference) {
      .skeleton {
        animation: pulse 1.4s ease-in-out infinite alternate;
      }
    }

    @keyframes pulse {
      to {
        opacity: 0.55;
      }
    }

    .icon {
      display: inline-block;
      inline-size: var(--_icon-size, 40px);
      block-size: var(--_icon-size, 40px);
      vertical-align: middle;
    }

    .icon svg {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }

    .condition {
      --_icon-size: 160px;
    }

    li:has(abbr) {
      --_icon-size: 36px;
    }

    .skeleton .icon {
      border-radius: 50%;
    }

    .skeleton .icon svg {
      visibility: hidden;
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
  declare locale: string | undefined;
  declare units: string | undefined;
  declare private forecast: ForecastState;

  #inFlight: AbortController | undefined;
  #viewport: IntersectionObserver | undefined;
  #nearViewport = false;
  #requestChanged = false;
  #format: Formatter = formatterFor(DEFAULT_LOCALE, DEFAULT_UNITS);
  readonly #motionPreference = new MotionPreference(this);

  constructor() {
    super();
    this.proxyUrl = PROXY_BASE_PATH;
    this.forecast = LOADING;
  }

  override connectedCallback() {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this.#refreshWhenStale);
    if (!this.#nearViewport) this.#waitUntilNearViewport();
    if (this.#requestChanged) this.requestUpdate();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("visibilitychange", this.#refreshWhenStale);
    if (this.#inFlight && this.forecast.status !== "ok") {
      this.#requestChanged = true;
    }
    this.#inFlight?.abort();
    this.#inFlight = undefined;
    this.#viewport?.disconnect();
  }

  readonly #refreshWhenStale = () => {
    const shown = this.forecast;
    if (
      document.visibilityState === "visible" &&
      this.#inFlight === undefined &&
      shown.status === "ok" &&
      Date.now() - shown.receivedAt > FORECAST_MAX_AGE_MILLISECONDS
    ) {
      void this.#refresh(shown);
    }
  };

  #waitUntilNearViewport() {
    this.#viewport = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        this.#viewport?.disconnect();
        this.#nearViewport = true;
        this.requestUpdate();
      },
      { rootMargin: NEAR_VIEWPORT_MARGIN },
    );
    this.#viewport.observe(this);
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has("locale") || changed.has("units")) {
      this.#format = formatterFor(
        parseLocale(this.locale),
        parseUnits(this.units),
      );
    }
    if (
      changed.has("latitude") ||
      changed.has("longitude") ||
      changed.has("proxyUrl") ||
      changed.has("parts")
    ) {
      this.#requestChanged = true;
    }
    if (this.#nearViewport && this.#requestChanged) {
      this.#requestChanged = false;
      void this.#load(this.forecast.status === "retrying" ? RETRYING : LOADING);
    }
  }

  #request() {
    this.#inFlight?.abort();
    this.#inFlight = undefined;
    const location = v.safeParse(CoordinatesSchema, {
      latitude: this.latitude,
      longitude: this.longitude,
    });
    if (!location.success) return undefined;

    const request = new AbortController();
    this.#inFlight = request;
    return fetchForecast(
      this.proxyUrl,
      location.output,
      requestedParts(this.parts),
      request.signal,
    ).then((forecast) => {
      if (request.signal.aborted) return undefined;
      this.#inFlight = undefined;
      return forecast;
    });
  }

  async #load(fetching: FetchingState = LOADING) {
    const answer = this.#request();
    if (!answer) {
      this.forecast = INVALID_LOCATION;
      return;
    }

    this.forecast = fetching;
    const forecast = await answer;
    if (!forecast) return;
    this.forecast =
      forecast.status === "ok"
        ? {
            ...forecast,
            nameTakesFocus:
              fetching.status === "retrying" &&
              this.shadowRoot?.activeElement != null,
            receivedAt: Date.now(),
          }
        : forecast;
  }

  async #refresh(shown: ShownForecast) {
    const forecast = await this.#request();
    if (forecast?.status !== "ok") return;
    this.forecast = {
      ...refreshedForecast(shown, forecast),
      status: "ok",
      nameTakesFocus: false,
      receivedAt: keepsShownParts(shown, forecast)
        ? shown.receivedAt
        : Date.now(),
    };
  }

  protected override updated(changed: PropertyValues) {
    if (this.forecast.status === "loading") {
      this.setAttribute("aria-busy", "true");
    } else {
      this.removeAttribute("aria-busy");
    }
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
      this.#format.coordinates(coordinates)
    );
  }

  #forecastAnnouncement(forecast: ShownForecast) {
    const observed = observedAt(forecast);
    const name = heard(this.#locationName(forecast));
    const headline = observed
      ? this.#format.messages.forecastForUpdatedAt(
          name,
          this.#format.time(observed, forecast.location.timeZone),
        )
      : this.#format.messages.forecastFor(name);
    const failedParts = FORECAST_PARTS.filter(
      (part) => forecast[part]?.status === "error",
    ).map((part) => this.#format.messages.partUnavailable[part]);
    return [
      ...(forecast.nameTakesFocus ? [] : [headline]),
      ...failedParts,
    ].join(ANNOUNCEMENT_SEPARATOR);
  }

  #announcement() {
    switch (this.forecast.status) {
      case "loading":
      case "retrying":
        return this.#format.messages.loading;
      case "ok":
        return this.#forecastAnnouncement(this.forecast);
      case "error":
      case "invalid-location":
        return this.#format.messages.forecastUnavailable;
    }
  }

  #skeleton() {
    const placeholder = placeholderForecast(
      requestedParts(this.parts),
      new Date(),
    );
    return html`<div class="skeleton" aria-hidden="true" inert>
      ${forecastView(
        this.#format,
        placeholder,
        this.#locationName(placeholder),
        STILL,
      )}
    </div>`;
  }

  #content() {
    switch (this.forecast.status) {
      case "loading":
        return this.#skeleton();
      case "ok":
        return forecastView(
          this.#format,
          this.forecast,
          this.#locationName(this.forecast),
          this.#motionPreference.motion,
        );
      case "error":
      case "retrying":
        return html`<p>${this.#format.messages.forecastUnavailable}</p>
          <button
            type="button"
            aria-disabled=${this.forecast.status === "retrying"}
            @click=${() => {
              this.#retry();
            }}
          >
            ${this.#format.messages.tryAgain}
          </button>`;
      case "invalid-location":
        return html`<p>${this.#format.messages.forecastUnavailable}</p>`;
    }
  }

  protected override render() {
    return html`<div lang=${this.#format.locale}>
      <div role="status" class="visually-hidden">${this.#announcement()}</div>
      ${this.#content()}
    </div>`;
  }
}
