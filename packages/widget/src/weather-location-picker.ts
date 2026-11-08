import {
  PROXY_BASE_PATH,
  roundCoordinates,
  type FoundLocation,
} from "@weather-widget/contract";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { parseLocale } from "./locale.ts";
import { findLocations } from "./location-search.ts";
import {
  PICKER_MESSAGES,
  type LocationError,
  type PickerMessages,
} from "./picker-messages.ts";
import { pickerStyles } from "./picker-styles.ts";

export const WEATHER_LOCATION_PICKER_TAG = "weather-location-picker";
export const LOCATION_SELECT_EVENT = "location-select";

export interface LocationSelectDetail {
  readonly latitude: number;
  readonly longitude: number;
  readonly name: string | null;
}

const DEVICE_LOCATION_OPTIONS: PositionOptions = {
  timeout: 10_000,
  maximumAge: 5 * 60 * 1000,
};

const LOCATION_ERRORS_BY_CODE: Readonly<Record<number, LocationError>> = {
  [GeolocationPositionError.PERMISSION_DENIED]: "denied",
  [GeolocationPositionError.TIMEOUT]: "timedOut",
};

const UNAVAILABLE: LocationError = "unavailable";

type Message =
  | { readonly kind: "none" }
  | { readonly kind: "found"; readonly count: number }
  | { readonly kind: "noneFound"; readonly term: string }
  | { readonly kind: "searchFailed" }
  | { readonly kind: "locating" }
  | { readonly kind: "locationError"; readonly error: LocationError };

const NO_MESSAGE: Message = { kind: "none" };

const textOf = (messages: PickerMessages, message: Message) => {
  switch (message.kind) {
    case "none":
      return "";
    case "found":
      return messages.foundCount(message.count);
    case "noneFound":
      return messages.noneFound(message.term);
    case "searchFailed":
      return messages.searchFailed;
    case "locating":
      return messages.locating;
    case "locationError":
      return messages.locationErrors[message.error];
  }
};

const contextOf = ({ region, country }: FoundLocation) =>
  [region, country].filter((part) => part !== null).join(", ");

const NAVIGATION_ICON = html`<svg
  aria-hidden="true"
  focusable="false"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <polygon points="3 11 22 2 13 21 11 13 3 11" />
</svg>`;

export class WeatherLocationPicker extends LitElement {
  static override properties = {
    locale: { type: String },
    proxyUrl: { type: String, attribute: "proxy-url" },
  };

  static override styles = pickerStyles;

  declare locale: string | undefined;
  declare proxyUrl: string;

  #messages: PickerMessages = PICKER_MESSAGES.en;
  #found: readonly FoundLocation[] = [];
  #message: Message = NO_MESSAGE;
  #locating = false;
  #search: AbortController | undefined;

  constructor() {
    super();
    this.proxyUrl = PROXY_BASE_PATH;
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#search?.abort();
  }

  protected override willUpdate(changed: PropertyValues<this>) {
    if (changed.has("locale")) {
      this.#messages = PICKER_MESSAGES[parseLocale(this.locale)];
    }
  }

  #show(found: readonly FoundLocation[], message: Message) {
    this.#found = found;
    this.#message = message;
    this.requestUpdate();
  }

  #say(message: Message) {
    this.#show(this.#found, message);
  }

  readonly #onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    const term = new FormData(event.currentTarget).get("q");
    const name = typeof term === "string" ? term.trim() : "";
    if (name === "") return;

    this.#search?.abort();
    const search = new AbortController();
    this.#search = search;
    const found = await findLocations(
      this.proxyUrl,
      name,
      parseLocale(this.locale),
      search.signal,
    );
    if (search.signal.aborted) return;

    if (found.status === "error") {
      this.#show([], { kind: "searchFailed" });
    } else if (found.data.length === 0) {
      this.#show([], { kind: "noneFound", term: name });
    } else {
      this.#show(found.data, { kind: "found", count: found.data.length });
    }
  };

  #select(detail: LocationSelectDetail) {
    this.dispatchEvent(
      new CustomEvent<LocationSelectDetail>(LOCATION_SELECT_EVENT, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  readonly #onLocate = () => {
    if (this.#locating) return;
    this.#locating = true;
    this.#say({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.#locating = false;
        this.#say(NO_MESSAGE);
        this.#select({ ...roundCoordinates(coords), name: null });
      },
      ({ code }) => {
        this.#locating = false;
        this.#say({
          kind: "locationError",
          error: LOCATION_ERRORS_BY_CODE[code] ?? UNAVAILABLE,
        });
      },
      DEVICE_LOCATION_OPTIONS,
    );
  };

  #locateButton() {
    if (!("geolocation" in navigator)) return nothing;
    return html`<button
      type="button"
      class="button locate"
      aria-disabled=${this.#locating}
      @click=${this.#onLocate}
    >
      ${NAVIGATION_ICON}${this.#messages.useMyLocation}
    </button>`;
  }

  #results() {
    if (this.#found.length === 0) return nothing;
    return html`<ul
      class="picker-results"
      aria-label=${this.#messages.locationsFound}
    >
      ${this.#found.map((location) => {
        const context = contextOf(location);
        return html`<li>
          <button
            type="button"
            class="result"
            @click=${() => {
              this.#select({
                latitude: location.latitude,
                longitude: location.longitude,
                name: location.name,
              });
            }}
          >
            <span class="result-name">${location.name}</span>${
              context === ""
                ? nothing
                : html` <span class="result-context">${context}</span>`
            }
          </button>
        </li>`;
      })}
    </ul>`;
  }

  protected override render() {
    const messages = this.#messages;
    return html`<div class="picker" lang=${parseLocale(this.locale)}>
      <form
        role="search"
        aria-label=${messages.chooseALocation}
        @submit=${this.#onSubmit}
      >
        <label for="term">${messages.location}</label>
        <div class="picker-row">
          <input
            id="term"
            type="search"
            name="q"
            autocomplete="off"
            spellcheck="false"
          />
          <button type="submit" class="button button-primary">
            ${messages.search}
          </button>
        </div>
      </form>
      ${this.#locateButton()}
      <p class="picker-message" role="status">
        ${textOf(messages, this.#message)}
      </p>
      ${this.#results()}
      <p class="credit">
        ${messages.creditSearchBy}
        <a href="https://open-meteo.com/">Open-Meteo</a>,
        ${messages.creditPlaceNamesFrom}
        <a href="https://www.geonames.org/">GeoNames</a>
        (<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>)
      </p>
    </div>`;
  }
}
