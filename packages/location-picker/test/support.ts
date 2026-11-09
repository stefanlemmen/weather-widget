import type {
  FoundLocation,
  LocationsResponse,
  ProblemDetails,
} from "@weather-widget/contract";
import * as v from "valibot";
import { afterEach, beforeEach, expect, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../src/index.ts";
import type { LocationSelectDetail } from "../src/index.ts";

export const unavailable: ProblemDetails = {
  type: "about:blank",
  title: "Search unavailable",
  status: 503,
};

export const respondWith = (body: unknown, status = 200) =>
  Promise.resolve(Response.json(body, { status }));

export const fakeProxy = vi.fn<typeof fetch>();

const urlOf = (input: RequestInfo | URL) =>
  new URL(input instanceof Request ? input.url : input, document.baseURI);

export const requestedUrls = () =>
  fakeProxy.mock.calls.map(([input]) => urlOf(input));

beforeEach(() => {
  fakeProxy.mockReset();
  vi.stubGlobal("fetch", fakeProxy);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

export const PARIS: FoundLocation = {
  name: "Paris",
  region: "Île-de-France Region",
  country: "France",
  latitude: 48.85341,
  longitude: 2.3488,
};

export const PARIS_TEXAS: FoundLocation = {
  name: "Paris",
  region: "Texas",
  country: "United States",
  latitude: 33.66094,
  longitude: -95.55551,
};

export const found = (...locations: FoundLocation[]): LocationsResponse => ({
  locations,
});

export const answering = (response: LocationsResponse) => {
  fakeProxy.mockImplementation(() => respondWith(response));
};

export const renderPicker = (
  attributes: Readonly<Record<string, string>> = {},
) => {
  const picker = document.createElement("weather-location-picker");
  for (const [name, value] of Object.entries(attributes)) {
    picker.setAttribute(name, value);
  }
  document.body.append(picker);
  return picker;
};

export const field = () => page.getByRole("searchbox", { name: "Location" });
export const searchButton = () => page.getByRole("button", { name: "Search" });
export const useMyLocation = () =>
  page.getByRole("button", { name: "Use my location" });
export const message = () => page.getByRole("status");
export const results = () =>
  page.getByRole("list", { name: "Locations found" });

export const expectFocusOn = async (
  picker: HTMLElement,
  locator: ReturnType<typeof page.getByRole>,
) => {
  await expect
    .poll(() => picker.shadowRoot?.activeElement)
    .toBe(locator.element());
};

export const search = async (term: string) => {
  await userEvent.fill(field(), term);
  await userEvent.click(searchButton());
};

export const LocationSelectDetailSchema = v.object({
  latitude: v.number(),
  longitude: v.number(),
  name: v.nullable(v.string()),
});

export const selections = () => {
  const selected: LocationSelectDetail[] = [];
  const listener = vi.fn((event: Event) => {
    if (event instanceof CustomEvent) {
      selected.push(v.parse(LocationSelectDetailSchema, event.detail));
    }
  });
  document.addEventListener("location-select", listener);
  onTestFinished(() => {
    document.removeEventListener("location-select", listener);
  });
  return { selected, listener };
};

export type Locate = (
  success: PositionCallback,
  failure: PositionErrorCallback,
  options: PositionOptions | undefined,
) => void;

export const fakeGeolocation = (locate: Locate) => {
  const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>(
    (success, failure, options) => {
      if (failure) locate(success, failure, options);
    },
  );
  const geolocation: Geolocation = {
    getCurrentPosition,
    watchPosition: () => 0,
    clearWatch: () => undefined,
  };
  vi.spyOn(navigator, "geolocation", "get").mockReturnValue(geolocation);
  return getCurrentPosition;
};

export const positionAt = (
  latitude: number,
  longitude: number,
): GeolocationPosition => {
  const coords: GeolocationCoordinates = {
    latitude,
    longitude,
    accuracy: 20,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({ latitude, longitude }),
  };
  return { coords, timestamp: Date.now(), toJSON: () => ({ coords }) };
};

export const POSITION_ERROR_CODES = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as const;

export const positionError = (code: number): GeolocationPositionError => ({
  code,
  message: "",
  ...POSITION_ERROR_CODES,
});
