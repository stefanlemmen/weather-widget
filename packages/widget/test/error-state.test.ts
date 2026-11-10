import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  NIEUWEGEIN,
  errorHeading,
  fakeProxy,
  forecastFailing,
  fullForecast,
  locationName,
  renderWidget,
  respondWith,
  unavailable,
  weatherProviderCredit,
} from "./support.ts";

const ACCENT = "rgb(23, 112, 63)";
const TRANSPARENT = "rgba(0, 0, 0, 0)";
const MAX_TABS = 5;
const EXPLANATION =
  "The weather service isn't available right now. Try again in a moment.";

const failing = () => {
  fakeProxy.mockImplementation(() => respondWith(unavailable, 503));
};

const tryAgain = () => page.getByRole("button", { name: "Try again" });

describe("the Error state", () => {
  it("keeps the name the Host page set in location-name", async () => {
    failing();

    renderWidget({ ...NIEUWEGEIN, "location-name": "Nieuwegein" });

    await expect.element(locationName()).toHaveTextContent("Nieuwegein");
  });

  it("names the Location by its coordinates without a location-name", async () => {
    failing();

    renderWidget(NIEUWEGEIN);

    await expect.element(locationName()).toHaveTextContent("52.03° N, 5.08° E");
  });

  it("explains what happened and what the visitor can do", async () => {
    failing();

    renderWidget(NIEUWEGEIN);

    await expect.element(errorHeading("Forecast unavailable")).toBeVisible();
    await expect.element(page.getByText(EXPLANATION)).toBeVisible();
    await expect.element(tryAgain()).toBeVisible();
  });

  it("explains in Dutch for a Dutch Widget", async () => {
    failing();

    renderWidget({ ...NIEUWEGEIN, locale: "nl" });

    await expect
      .element(
        page.getByText(
          "De weerdienst is nu niet beschikbaar. Probeer het zo opnieuw.",
        ),
      )
      .toBeVisible();
  });

  it("draws the N/A mark, hidden from screen readers", async () => {
    failing();

    const widget = renderWidget(NIEUWEGEIN);

    await expect.element(errorHeading("Forecast unavailable")).toBeVisible();
    const mark = widget.shadowRoot?.querySelector(".error svg");
    expect(mark).not.toBeNull();
    expect(mark?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("keeps crediting OpenWeather", async () => {
    failing();

    renderWidget(NIEUWEGEIN);

    await expect.element(weatherProviderCredit()).toBeVisible();
  });

  it("leaves out the explanation and Try again when the Location is invalid", async () => {
    renderWidget({ latitude: "north", longitude: "5.08" });

    await expect.element(errorHeading("Forecast unavailable")).toBeVisible();
    expect(page.getByText(EXPLANATION).query()).toBeNull();
    expect(tryAgain().query()).toBeNull();
  });

  it("shows Try again as busy, without the hover tint, while it fetches again", async () => {
    fakeProxy.mockImplementationOnce(() => respondWith(unavailable, 503));
    renderWidget(NIEUWEGEIN);
    fakeProxy.mockImplementationOnce(() => new Promise(() => undefined));

    await tryAgain().click();
    await userEvent.hover(tryAgain());

    await expect.element(tryAgain()).toHaveAttribute("aria-disabled", "true");
    const styles = getComputedStyle(tryAgain().element());
    expect(styles.cursor).toBe("progress");
    expect(styles.backgroundColor).toBe(TRANSPARENT);
  });
});

describe("the Unavailable message", () => {
  it("draws the N/A mark before the message, hidden from screen readers", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastFailing("hourly")));

    renderWidget(NIEUWEGEIN);

    const line = page
      .getByRole("paragraph")
      .filter({ hasText: "Hourly forecast unavailable" });
    await expect.element(line).toBeVisible();
    const mark = line.element().querySelector("svg");
    expect(mark).not.toBeNull();
    expect(mark?.closest('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("focus", () => {
  const ringOf = (element: Element) => {
    const { outlineStyle, outlineWidth, outlineColor, outlineOffset } =
      getComputedStyle(element);
    return { outlineStyle, outlineWidth, outlineColor, outlineOffset };
  };

  it("rings Try again in the accent when the visitor reaches it by keyboard", async () => {
    failing();
    renderWidget(NIEUWEGEIN);
    await expect.element(tryAgain()).toBeVisible();

    const widget = tryAgain().element().getRootNode();
    for (
      let presses = 0;
      presses < MAX_TABS &&
      widget instanceof ShadowRoot &&
      widget.activeElement !== tryAgain().element();
      presses++
    ) {
      await userEvent.tab();
    }

    expect(ringOf(tryAgain().element())).toEqual({
      outlineStyle: "solid",
      outlineWidth: "2px",
      outlineColor: ACCENT,
      outlineOffset: "3px",
    });
  });

  it("rings the Location's name when focus moves there after Try again by keyboard", async () => {
    fakeProxy.mockImplementationOnce(() => respondWith(unavailable, 503));
    renderWidget(NIEUWEGEIN);
    await expect.element(tryAgain()).toBeVisible();
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    tryAgain().element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(page.getByText("9°", { exact: true })).toBeVisible();
    expect(ringOf(locationName().element())).toEqual({
      outlineStyle: "solid",
      outlineWidth: "2px",
      outlineColor: ACCENT,
      outlineOffset: "3px",
    });
  });
});
