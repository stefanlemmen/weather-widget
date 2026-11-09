import type {
  FoundLocation,
  LocationsResponse,
} from "@weather-widget/contract";
import * as v from "valibot";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../src/location-picker.ts";
import type { LocationSelectDetail } from "../src/location-picker.ts";
import {
  fakeProxy,
  requestedUrls,
  respondWith,
  unavailable,
} from "./support.ts";

const PARIS: FoundLocation = {
  name: "Paris",
  region: "Île-de-France Region",
  country: "France",
  latitude: 48.85341,
  longitude: 2.3488,
};

const PARIS_TEXAS: FoundLocation = {
  name: "Paris",
  region: "Texas",
  country: "United States",
  latitude: 33.66094,
  longitude: -95.55551,
};

const found = (...locations: FoundLocation[]): LocationsResponse => ({
  locations,
});

const answering = (response: LocationsResponse) => {
  fakeProxy.mockImplementation(() => respondWith(response));
};

const renderPicker = (attributes: Readonly<Record<string, string>> = {}) => {
  const picker = document.createElement("weather-location-picker");
  for (const [name, value] of Object.entries(attributes)) {
    picker.setAttribute(name, value);
  }
  document.body.append(picker);
  return picker;
};

const field = () => page.getByRole("searchbox", { name: "Location" });
const searchButton = () => page.getByRole("button", { name: "Search" });
const useMyLocation = () =>
  page.getByRole("button", { name: "Use my location" });
const message = () => page.getByRole("status");
const results = () => page.getByRole("list", { name: "Locations found" });

const expectFocusOn = async (
  picker: HTMLElement,
  locator: ReturnType<typeof page.getByRole>,
) => {
  await expect
    .poll(() => picker.shadowRoot?.activeElement)
    .toBe(locator.element());
};

const search = async (term: string) => {
  await userEvent.fill(field(), term);
  await userEvent.click(searchButton());
};

const LocationSelectDetailSchema = v.object({
  latitude: v.number(),
  longitude: v.number(),
  name: v.nullable(v.string()),
});

const selections = () => {
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

type Locate = (
  success: PositionCallback,
  failure: PositionErrorCallback,
  options: PositionOptions | undefined,
) => void;

const fakeGeolocation = (locate: Locate) => {
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

const positionAt = (
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

const POSITION_ERROR_CODES = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as const;

const positionError = (code: number): GeolocationPositionError => ({
  code,
  message: "",
  ...POSITION_ERROR_CODES,
});

describe("the Location picker's search", () => {
  it("offers a search form with a labelled field and a Search button", async () => {
    renderPicker();

    await expect
      .element(page.getByRole("search", { name: "Choose a location" }))
      .toBeVisible();
    await expect.element(field()).toBeVisible();
    await expect.element(searchButton()).toBeVisible();
  });

  it("asks the Proxy for Locations matching the trimmed term in the picker's locale", async () => {
    answering(found(PARIS));
    renderPicker();

    await search("  Paris ");

    await expect.element(results()).toBeVisible();
    const [url] = requestedUrls();
    expect(url?.pathname).toBe("/api/locations");
    expect(url?.searchParams.get("name")).toBe("Paris");
    expect(url?.searchParams.get("locale")).toBe("en");
  });

  it("asks the Proxy at its proxy-url", async () => {
    answering(found(PARIS));
    renderPicker({ "proxy-url": "https://weather.example/api" });

    await search("Paris");

    await expect.element(results()).toBeVisible();
    expect(requestedUrls()[0]?.href).toBe(
      "https://weather.example/api/locations?name=Paris&locale=en",
    );
  });

  it("searches when the visitor presses Enter in the field", async () => {
    answering(found(PARIS));
    renderPicker();

    await userEvent.type(field(), "Paris{Enter}");

    await expect.element(results()).toBeVisible();
  });

  it("doesn't search for a blank term", async () => {
    renderPicker();

    await search("   ");

    expect(fakeProxy).not.toHaveBeenCalled();
    await expect.element(message()).toHaveTextContent("");
  });

  it("shows each Location as a button with its region and country", async () => {
    answering(found(PARIS, PARIS_TEXAS));
    renderPicker();

    await search("Paris");

    const buttons = results().getByRole("button");
    await expect
      .element(buttons.nth(0))
      .toHaveTextContent("Paris Île-de-France Region, France");
    await expect
      .element(buttons.nth(1))
      .toHaveTextContent("Paris Texas, United States");
  });

  it("shows a Location without a region or country by its name alone", async () => {
    answering(
      found({ ...PARIS, name: "Null Island", region: null, country: null }),
    );
    renderPicker();

    await search("Null Island");

    await expect
      .element(results().getByRole("button"))
      .toHaveTextContent(/^Null Island$/);
  });

  it.each([
    [[PARIS, PARIS_TEXAS], "2 locations found"],
    [[PARIS], "1 location found"],
  ])("announces how many Locations it found", async (locations, announced) => {
    answering(found(...locations));
    renderPicker();

    await search("Paris");

    await expect.element(message()).toHaveTextContent(announced);
  });

  it("announces the search while the Proxy hasn't answered yet", async () => {
    fakeProxy.mockImplementation(() => new Promise<Response>(() => undefined));
    renderPicker();

    await search(" Paris ");

    await expect.element(message()).toHaveTextContent("Searching for “Paris”…");
  });

  it("announces that it found nothing, with the term the visitor typed", async () => {
    answering(found());
    renderPicker();

    await search("Parjs");

    await expect
      .element(message())
      .toHaveTextContent(
        "No locations found for “Parjs”. Check the spelling or try a nearby town.",
      );
    await expect.element(results()).not.toBeInTheDocument();
  });

  it.each([
    ["answers with an error", () => respondWith(unavailable, 503)],
    ["answers with an unexpected shape", () => respondWith({ places: [] })],
    ["can't be reached", () => Promise.reject(new TypeError("offline"))],
  ])("announces a failed search when the Proxy %s", async (_, respond) => {
    fakeProxy.mockImplementation(respond);
    renderPicker();

    await search("Paris");

    await expect
      .element(message())
      .toHaveTextContent(
        "Search isn't working right now. Try again in a moment.",
      );
  });

  it("shows only the latest search when an earlier one answers late", async () => {
    let answerEarlier: (response: Response) => void = () => undefined;
    const earlier = new Promise<Response>((resolve) => {
      answerEarlier = resolve;
    });
    fakeProxy
      .mockImplementationOnce(() => earlier)
      .mockImplementation(() => respondWith(found(PARIS_TEXAS)));
    renderPicker();

    await search("Paris");
    await search("Paris Texas");
    await expect.element(results()).toHaveTextContent("Texas");
    answerEarlier(Response.json(found(PARIS)));

    await expect.element(results()).not.toHaveTextContent("France");
  });

  it("emits a bubbling, composed location-select with the chosen Location", async () => {
    answering(found(PARIS, PARIS_TEXAS));
    const { selected, listener } = selections();
    renderPicker();
    await search("Paris");

    await userEvent.click(results().getByRole("button").nth(1));

    expect(selected).toEqual([
      { latitude: 33.66094, longitude: -95.55551, name: "Paris" },
    ]);
    const [event] = listener.mock.calls[0] ?? [];
    expect(event?.bubbles).toBe(true);
    expect(event?.composed).toBe(true);
  });

  it("confirms the chosen Location, clears the results and returns focus to the field", async () => {
    answering(found(PARIS, PARIS_TEXAS));
    const picker = renderPicker();
    await search("Paris");

    await userEvent.click(results().getByRole("button").nth(0));

    await expect.element(message()).toHaveTextContent("Paris chosen");
    await expect.element(results()).not.toBeInTheDocument();
    await expectFocusOn(picker, field());
  });

  it("cancels a running search when the visitor chooses a Location", async () => {
    fakeProxy
      .mockImplementationOnce(() => respondWith(found(PARIS)))
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    renderPicker();
    await search("Paris");
    await expect.element(results()).toBeVisible();
    await search("Paris Texas");

    await userEvent.click(results().getByRole("button").nth(0));

    expect(fakeProxy.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
    await expect.element(message()).toHaveTextContent("Paris chosen");
  });

  it("lets a keyboard user search and choose a Location in visual order", async () => {
    answering(found(PARIS, PARIS_TEXAS));
    fakeGeolocation(() => undefined);
    const { selected } = selections();
    const picker = renderPicker();

    await userEvent.tab();
    await expectFocusOn(picker, field());
    await userEvent.keyboard("Paris");
    await userEvent.tab();
    await expectFocusOn(picker, searchButton());
    await userEvent.keyboard("{Enter}");
    await expect.element(results()).toBeVisible();
    await userEvent.tab();
    await expectFocusOn(picker, useMyLocation());
    await userEvent.tab();
    await expectFocusOn(picker, results().getByRole("button").nth(0));
    await userEvent.keyboard("{Enter}");

    expect(selected).toEqual([
      { latitude: 48.85341, longitude: 2.3488, name: "Paris" },
    ]);
  });
});

describe("the Location picker's device Location", () => {
  it("offers Use my location when the Geolocation API exists", async () => {
    fakeGeolocation(() => undefined);
    renderPicker();

    await expect.element(useMyLocation()).toBeVisible();
  });

  it("leaves out Use my location without the Geolocation API", async () => {
    vi.stubGlobal("navigator", {});
    renderPicker();

    await expect.element(searchButton()).toBeVisible();
    await expect.element(useMyLocation()).not.toBeInTheDocument();
  });

  it("emits the device's Location rounded to 2 decimals and without a name", async () => {
    fakeGeolocation((success) => {
      success(positionAt(52.034_91, 5.075_12));
    });
    const { selected } = selections();
    renderPicker();

    await userEvent.click(useMyLocation());

    expect(selected).toEqual([
      { latitude: 52.03, longitude: 5.08, name: null },
    ]);
  });

  it("asks the device once while it finds the Location, and says so", async () => {
    const getCurrentPosition = fakeGeolocation(() => undefined);
    renderPicker();

    await userEvent.click(useMyLocation());
    useMyLocation().element().dispatchEvent(new MouseEvent("click"));

    await expect
      .element(useMyLocation())
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(message()).toHaveTextContent("Finding your location…");
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("asks the device with a time limit", async () => {
    const getCurrentPosition = fakeGeolocation(() => undefined);
    renderPicker();

    await userEvent.click(useMyLocation());

    expect(getCurrentPosition.mock.calls[0]?.[2]?.timeout).toBeGreaterThan(0);
  });

  it("clears the message and lets the visitor locate again once found", async () => {
    fakeGeolocation((success) => {
      success(positionAt(52.03, 5.08));
    });
    renderPicker();

    await userEvent.click(useMyLocation());

    await expect
      .element(useMyLocation())
      .not.toHaveAttribute("aria-disabled", "true");
    await expect.element(message()).toHaveTextContent("");
  });

  it.each([
    [
      "denied",
      POSITION_ERROR_CODES.PERMISSION_DENIED,
      "Location access is off. You can turn it on in your browser settings.",
    ],
    [
      "timed out",
      POSITION_ERROR_CODES.TIMEOUT,
      "Finding your location took too long. Try again.",
    ],
    [
      "unavailable",
      POSITION_ERROR_CODES.POSITION_UNAVAILABLE,
      "Your device couldn't find its location. Try again or search by name.",
    ],
  ])(
    "announces a %s device Location and emits nothing",
    async (_, code, announced) => {
      fakeGeolocation((_success, failure) => {
        failure(positionError(code));
      });
      const { selected } = selections();
      renderPicker();

      await userEvent.click(useMyLocation());

      await expect.element(message()).toHaveTextContent(announced);
      await expect
        .element(useMyLocation())
        .not.toHaveAttribute("aria-disabled", "true");
      expect(selected).toEqual([]);
    },
  );
});

describe("the Location picker's layout", () => {
  const ROW_GAP_PX = 16;

  it("leaves no gap for an empty message", async () => {
    fakeGeolocation(() => undefined);
    const picker = renderPicker();
    await expect.element(useMyLocation()).toBeVisible();

    const credit = picker.shadowRoot?.querySelector(".credit");
    const locateBottom = useMyLocation()
      .element()
      .getBoundingClientRect().bottom;
    const creditTop = credit?.getBoundingClientRect().top ?? 0;

    expect(creditTop - locateBottom).toBeCloseTo(ROW_GAP_PX, 0);
  });
});

describe("the Location picker's credit and locale", () => {
  it.each([
    ["Open-Meteo", "https://open-meteo.com/"],
    ["GeoNames", "https://www.geonames.org/"],
    ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  ])("credits %s", async (name, href) => {
    renderPicker();

    await expect
      .element(page.getByRole("link", { name, exact: true }))
      .toHaveAttribute("href", href);
  });

  it("speaks Dutch in a Dutch picker and searches in Dutch", async () => {
    answering(found(PARIS));
    fakeGeolocation(() => undefined);
    renderPicker({ locale: "nl" });

    await expect
      .element(page.getByRole("search", { name: "Kies een locatie" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Gebruik mijn locatie" }))
      .toBeVisible();
    await userEvent.fill(
      page.getByRole("searchbox", { name: "Locatie" }),
      "Parijs",
    );
    await userEvent.click(page.getByRole("button", { name: "Zoeken" }));

    await expect.element(message()).toHaveTextContent("1 locatie gevonden");
    expect(requestedUrls()[0]?.searchParams.get("locale")).toBe("nl");

    await userEvent.click(
      page.getByRole("list", { name: "Gevonden locaties" }).getByRole("button"),
    );

    await expect.element(message()).toHaveTextContent("Paris gekozen");
  });

  it("announces a running search in Dutch", async () => {
    fakeProxy.mockImplementation(() => new Promise<Response>(() => undefined));
    renderPicker({ locale: "nl" });

    await userEvent.fill(
      page.getByRole("searchbox", { name: "Locatie" }),
      "Parijs",
    );
    await userEvent.click(page.getByRole("button", { name: "Zoeken" }));

    await expect.element(message()).toHaveTextContent("Zoeken naar ‘Parijs’…");
  });

  it("falls back to English for an unknown locale", async () => {
    renderPicker({ locale: "fr" });

    await expect.element(searchButton()).toBeVisible();
  });
});
