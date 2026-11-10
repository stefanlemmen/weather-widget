import {
  CoordinatesSchema,
  DEFAULT_LOCALE,
  parseLocale,
  PROXY_BASE_PATH,
} from "@weather-widget/contract";
import { html, LitElement, type PropertyValues } from "lit";
import * as v from "valibot";
import { formatterFor, type Formatter, type Spoken } from "./formatter.ts";
import { requestedParts, type Forecast } from "./forecast-client.ts";
import { ForecastLoader, type ForecastState } from "./forecast-loader.ts";
import {
  errorStateView,
  forecastAnnouncement,
  forecastView,
} from "./forecast-view.ts";
import { MotionPreference, STILL } from "./motion-preference.ts";
import { placeholderForecast } from "./forecast-skeleton.ts";
import { DEFAULT_UNITS, parseUnits } from "./units.ts";
import { styles } from "./styles.ts";

export const WEATHER_WIDGET_TAG = "weather-widget";

const nonBlank = (text: string | undefined) => {
  const trimmed = text?.trim();
  return trimmed === "" ? undefined : trimmed;
};

export class WeatherWidget extends LitElement {
  static override properties = {
    latitude: { type: Number },
    longitude: { type: Number },
    proxyUrl: { type: String, attribute: "proxy-url" },
    locationName: { type: String, attribute: "location-name" },
    parts: { type: String },
    locale: { type: String },
    units: { type: String },
  };

  static override styles = styles;

  declare latitude: number | undefined;
  declare longitude: number | undefined;
  declare proxyUrl: string;
  declare locationName: string | undefined;
  declare parts: string | undefined;
  declare locale: string | undefined;
  declare units: string | undefined;

  #format: Formatter = formatterFor(DEFAULT_LOCALE, DEFAULT_UNITS);
  #rendered: ForecastState | undefined;
  readonly #motionPreference = new MotionPreference(this);
  readonly #loader = new ForecastLoader(this);

  constructor() {
    super();
    this.proxyUrl = PROXY_BASE_PATH;
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has("locale") || changed.has("units")) {
      this.#format = formatterFor(
        parseLocale(this.locale),
        parseUnits(this.units),
      );
    }
  }

  protected override updated() {
    const forecast = this.#loader.state;
    if (forecast.status === "loading") {
      this.setAttribute("aria-busy", "true");
    } else {
      this.removeAttribute("aria-busy");
    }
    if (
      forecast !== this.#rendered &&
      forecast.status === "ok" &&
      forecast.nameTakesFocus
    ) {
      this.renderRoot.querySelector("h2")?.focus();
    }
    this.#rendered = forecast;
  }

  #locationName({ coordinates, location }: Forecast): Spoken | string {
    return (
      nonBlank(this.locationName) ??
      location.name ??
      this.#format.coordinates(coordinates)
    );
  }

  #requestedName(): Spoken | string | undefined {
    const coordinates = v.safeParse(CoordinatesSchema, {
      latitude: this.latitude,
      longitude: this.longitude,
    });
    return (
      nonBlank(this.locationName) ??
      (coordinates.success
        ? this.#format.coordinates(coordinates.output)
        : undefined)
    );
  }

  #skeleton() {
    const placeholder = placeholderForecast(
      requestedParts(this.parts),
      new Date(),
    );
    return html`<div class="skeleton" aria-hidden="true" inert>
      ${forecastView(
        { format: this.#format, motion: STILL },
        placeholder,
        this.#locationName(placeholder),
      )}
    </div>`;
  }

  #content(forecast: ForecastState) {
    switch (forecast.status) {
      case "loading":
        return this.#skeleton();
      case "ok":
        return forecastView(
          { format: this.#format, motion: this.#motionPreference.motion },
          forecast,
          this.#locationName(forecast),
        );
      case "error":
      case "retrying":
        return errorStateView(
          this.#format,
          this.#requestedName(),
          html`<button
            type="button"
            class="button"
            aria-disabled=${forecast.status === "retrying"}
            @click=${() => {
              this.#loader.retry();
            }}
          >
            ${this.#format.messages.tryAgain}
          </button>`,
        );
      case "invalid-location":
        return errorStateView(this.#format, nonBlank(this.locationName));
    }
  }

  protected override render() {
    const forecast = this.#loader.state;
    const announcement = forecastAnnouncement(this.#format, forecast, (shown) =>
      this.#locationName(shown),
    );
    return html`<div class="widget" lang=${this.#format.locale}>
      <div role="status" class="visually-hidden">${announcement}</div>
      ${this.#content(forecast)}
    </div>`;
  }
}
