import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  NIEUWEGEIN,
  forecastWith,
  fullForecast,
  unavailable,
  shownMessage,
  announcement,
  locationName,
  respondWith,
  fakeProxy,
  renderWidget,
  textsOf,
  conditionsShownIn,
} from "./support.ts";

describe("locale", () => {
  const DUTCH = { ...NIEUWEGEIN, locale: "nl" };

  it("shows Current conditions in Dutch, with Dutch numbers and the Location's local time", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWith()));

    renderWidget(DUTCH);

    await expect
      .element(announcement())
      .toHaveTextContent(
        "Weersverwachting voor Nieuwegein, bijgewerkt om 10:41",
      );
    expect(
      page.getByText("Gevoelstemperatuur").element().nextElementSibling,
    ).toHaveTextContent("7°");
    expect(
      page.getByText("Wind", { exact: true }).element().nextElementSibling,
    ).toHaveTextContent("12 km/u ZZW");
    expect(
      page.getByText("Kans op neerslag").element().nextElementSibling,
    ).toHaveTextContent("85%");
    await expect
      .element(shownMessage("Bijgewerkt om"))
      .toHaveTextContent("Bijgewerkt om 10:41");
    await expect
      .element(page.getByRole("link", { name: "OpenWeather" }))
      .toBeVisible();
    expect(shownMessage("Weergegevens van").query()).not.toBeNull();
  });

  it("shows the Hourly and Daily forecast in Dutch, with hours on the 24-hour clock and Dutch day names", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(DUTCH);

    const hours = page.getByRole("list", { name: "Komende 12 uur" });
    const days = page.getByRole("list", { name: "Komende 5 dagen" });
    await expect.element(hours).toBeVisible();
    expect(hours.getByRole("listitem").elements()[0]).toHaveTextContent(
      /10:00.*31°.*Kans op neerslag\s*85%/,
    );
    expect(conditionsShownIn(hours)[0]).toBe("Regen");
    expect(conditionsShownIn(days)[0]).toBe("Regen");
    expect(textsOf(hours, "time").slice(0, 3)).toEqual([
      "10:00",
      "11:00",
      "12:00",
    ]);
    const firstDay = days.getByRole("listitem").first();
    expect(firstDay.element()).toHaveTextContent(
      /zo.*Laagste\s*21°.*Hoogste\s*50°/,
    );
    expect(firstDay.element().querySelector("abbr")?.title).toBe("zondag");
  });

  it("tells screen readers the temperatures, wind and coordinates in full in Dutch", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastWith({}, { name: null })),
    );

    renderWidget(DUTCH);

    await expect
      .element(page.getByText("9 graden Celsius"))
      .toBeInTheDocument();
    expect(
      page.getByText("12 kilometer per uur uit het zuidzuidwesten").query(),
    ).not.toBeNull();
    await expect.element(locationName()).toHaveTextContent("52,03° N, 5,08° O");
    expect(announcement().element()).toHaveTextContent(
      "Weersverwachting voor 52,03 graden noorderbreedte, 5,08 graden oosterlengte, bijgewerkt om 10:41",
    );
  });

  it("tells screen readers the Widget's text is in the locale's language", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWith()));

    renderWidget(DUTCH);

    await expect.element(locationName()).toBeVisible();
    expect(
      locationName().element().closest("[lang]")?.getAttribute("lang"),
    ).toBe("nl");
    expect(
      announcement().element().closest("[lang]")?.getAttribute("lang"),
    ).toBe("nl");
  });

  it('shows "Weersverwachting niet beschikbaar" and "Opnieuw proberen" when the Proxy fails', async () => {
    fakeProxy.mockImplementation(() => respondWith(unavailable, 503));

    renderWidget(DUTCH);

    await expect
      .element(page.getByRole("button", { name: "Opnieuw proberen" }))
      .toBeVisible();
    expect(
      shownMessage("Weersverwachting niet beschikbaar").query(),
    ).not.toBeNull();
  });

  it.each([
    ["absent", {}],
    ["unsupported", { locale: "fr" }],
    ["a regional variant", { locale: "en-GB" }],
    ["in capitals", { locale: "NL" }],
    ["empty", { locale: "" }],
  ])("shows English when the locale is %s", async (_, attributes) => {
    fakeProxy.mockImplementation(() => respondWith(forecastWith()));

    renderWidget({ ...NIEUWEGEIN, ...attributes });

    await expect
      .element(announcement())
      .toHaveTextContent("Forecast for Nieuwegein, updated at 10:41 AM");
    expect(
      locationName().element().closest("[lang]")?.getAttribute("lang"),
    ).toBe("en");
  });

  it("switches language without asking the Proxy again when the Host page changes the locale", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWith()));
    const widget = renderWidget(NIEUWEGEIN);
    await expect.element(page.getByText("Feels like")).toBeVisible();

    widget.setAttribute("locale", "nl");

    await expect.element(page.getByText("Gevoelstemperatuur")).toBeVisible();
    expect(fakeProxy).toHaveBeenCalledOnce();
  });
});
