import {
  DEFAULT_LOCALE,
  parseLocale,
  PROXY_BASE_PATH,
  roundCoordinates,
  SEARCH_TERM_MAX_LENGTH,
  type Coordinates,
  type FoundLocation,
  type Locale,
  type Result,
} from "@weather-widget/contract";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { findLocations } from "./locations-client.ts";
import { MESSAGES, type LocationError, type Messages } from "./messages.ts";
import { NAVIGATION_ICON } from "./navigation-icon.ts";
import { styles } from "./styles.ts";

export const WEATHER_LOCATION_PICKER_TAG = "weather-location-picker";
export const LOCATION_SELECT_EVENT = "location-select";

export type LocationSelectDetail = Coordinates & {
  readonly name: string | null;
};

const SEARCH_FIELD_ID = "search-term";
const SEARCH_FIELD_NAME = "q";

const CREDIT_LINKS = {
  openMeteo: "https://open-meteo.com/",
  geoNames: "https://www.geonames.org/",
  ccBy: "https://creativecommons.org/licenses/by/4.0/",
} as const;

const DEVICE_LOCATION_TIMEOUT_MS = 10_000;
const DEVICE_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;

const DEVICE_LOCATION_OPTIONS: PositionOptions = {
  timeout: DEVICE_LOCATION_TIMEOUT_MS,
  maximumAge: DEVICE_LOCATION_MAX_AGE_MS,
};

const locationErrorOf = (error: GeolocationPositionError): LocationError => {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.TIMEOUT) return "timedOut";
  return "unavailable";
};

type Message =
  | { readonly kind: "none" }
  | { readonly kind: "searching"; readonly term: string }
  | { readonly kind: "found"; readonly count: number }
  | { readonly kind: "noneFound"; readonly term: string }
  | { readonly kind: "chosen"; readonly name: string }
  | { readonly kind: "searchFailed" }
  | { readonly kind: "locating" }
  | { readonly kind: "locationError"; readonly error: LocationError };

const NO_MESSAGE: Message = { kind: "none" };

const searchMessageFor = (
  found: Result<readonly FoundLocation[]>,
  term: string,
): Message => {
  if (found.status === "error") return { kind: "searchFailed" };
  if (found.data.length === 0) return { kind: "noneFound", term };
  return { kind: "found", count: found.data.length };
};

const textOf = (messages: Messages, message: Message) => {
  switch (message.kind) {
    case "none":
      return "";
    case "searching":
      return messages.searching(message.term);
    case "found":
      return messages.foundCount(message.count);
    case "noneFound":
      return messages.noneFound(message.term);
    case "chosen":
      return messages.chosen(message.name);
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

export class WeatherLocationPicker extends LitElement {
  static override properties = {
    locale: { type: String },
    proxyUrl: { type: String, attribute: "proxy-url" },
  };

  static override styles = styles;

  declare locale: string | undefined;
  declare proxyUrl: string;

  #locale: Locale = DEFAULT_LOCALE;
  #messages: Messages = MESSAGES[DEFAULT_LOCALE];
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
      this.#locale = parseLocale(this.locale);
      this.#messages = MESSAGES[this.#locale];
    }
  }

  #showResults(found: readonly FoundLocation[], message: Message) {
    this.#found = found;
    this.#message = message;
    this.requestUpdate();
  }

  #announce(message: Message) {
    this.#showResults(this.#found, message);
  }

  readonly #onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    const term = new FormData(event.currentTarget).get(SEARCH_FIELD_NAME);
    const name = typeof term === "string" ? term.trim() : "";
    if (name === "") return;

    this.#search?.abort();
    const search = new AbortController();
    this.#search = search;
    this.#announce({ kind: "searching", term: name });
    const found = await findLocations(
      this.proxyUrl,
      { name, locale: this.#locale },
      search.signal,
    );
    if (search.signal.aborted) return;

    this.#showResults(
      found.status === "ok" ? found.data : [],
      searchMessageFor(found, name),
    );
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

  async #choose({ latitude, longitude, name }: FoundLocation) {
    this.#search?.abort();
    this.#select({ latitude, longitude, name });
    this.#showResults([], { kind: "chosen", name });
    await this.updateComplete;
    this.renderRoot
      .querySelector<HTMLInputElement>(`#${SEARCH_FIELD_ID}`)
      ?.focus();
  }

  readonly #onLocate = () => {
    if (this.#locating) return;
    this.#locating = true;
    this.#announce({ kind: "locating" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        this.#locating = false;
        this.#announce(NO_MESSAGE);
        this.#select({ ...roundCoordinates(coords), name: null });
      },
      (error) => {
        this.#locating = false;
        this.#announce({
          kind: "locationError",
          error: locationErrorOf(error),
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
      aria-label=${this.#messages.useMyLocation}
      title=${this.#messages.useMyLocation}
      aria-disabled=${this.#locating}
      @click=${this.#onLocate}
    >
      ${NAVIGATION_ICON}
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
              void this.#choose(location);
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
    const message = textOf(messages, this.#message);
    return html`<div class="picker" lang=${this.#locale}>
      <form
        role="search"
        aria-label=${messages.chooseALocation}
        @submit=${this.#onSubmit}
      >
        <label for=${SEARCH_FIELD_ID}>${messages.location}</label>
        <div class="picker-row">
          <input
            id=${SEARCH_FIELD_ID}
            type="search"
            name=${SEARCH_FIELD_NAME}
            maxlength=${SEARCH_TERM_MAX_LENGTH}
            autocomplete="off"
            spellcheck="false"
          />
          <button type="submit" class="button button-primary">
            ${messages.search}
          </button>
          ${this.#locateButton()}
        </div>
      </form>
      <p
        class=${message === "" ? "picker-message is-empty" : "picker-message"}
        role="status"
      >
        ${message}
      </p>
      ${this.#results()}
      <p class="credit">
        ${messages.creditSearchBy}
        <a href=${CREDIT_LINKS.openMeteo}>Open-Meteo</a>,
        ${messages.creditPlaceNamesFrom}
        <a href=${CREDIT_LINKS.geoNames}>GeoNames</a>
        (<a href=${CREDIT_LINKS.ccBy}>CC BY 4.0</a>)
      </p>
    </div>`;
  }
}
