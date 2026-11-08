import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  NIEUWEGEIN,
  forecastWith,
  fullForecast,
  forecastFailing,
  shownMessage,
  announcement,
  locationName,
  respondWith,
  fakeProxy,
  requestedUrls,
  nearViewport,
  renderWidget,
  ALL_PARTS,
  hourlyForecast,
  dailyForecast,
  weatherProviderCredit,
} from "./support.ts";

describe("Forecast parts", () => {
  const SHOWN_FOR_PARTS = [
    ["current", "current"],
    ["hourly", "hourly"],
    ["daily", "daily"],
    ["current hourly", "current,hourly"],
    ["current daily", "current,daily"],
    ["hourly daily", "hourly,daily"],
    ["current hourly daily", "current,hourly,daily"],
  ] as const;

  const shownParts = () =>
    [
      page.getByText("Feels like").query() && "current",
      hourlyForecast().query() && "hourly",
      dailyForecast().query() && "daily",
    ]
      .filter(Boolean)
      .join(",");

  it.each(SHOWN_FOR_PARTS)(
    'shows and asks the Proxy for exactly the Forecast parts in parts="%s"',
    async (parts, requested) => {
      fakeProxy.mockImplementation(() => respondWith(fullForecast()));

      renderWidget({ ...NIEUWEGEIN, parts });

      await expect.element(locationName()).toBeVisible();
      expect(shownParts()).toBe(requested);
      expect(requestedUrls()[0]?.searchParams.get("parts")).toBe(requested);
    },
  );

  it.each([
    ["in any order", "daily current", "current,daily"],
    ["repeated", "hourly hourly", "hourly"],
    ["with extra whitespace", "  daily\n\thourly  ", "hourly,daily"],
    ["next to an unknown part", "weekly daily", "daily"],
    ["only unknown", "weekly", ALL_PARTS],
    ["empty", "", ALL_PARTS],
  ])(
    "asks for the Forecast parts in the fixed order when parts are %s",
    async (_, parts, requested) => {
      fakeProxy.mockImplementation(() => respondWith(fullForecast()));

      renderWidget({ ...NIEUWEGEIN, parts });

      await vi.waitFor(() => {
        expect(fakeProxy).toHaveBeenCalledOnce();
      });
      expect(requestedUrls()[0]?.searchParams.get("parts")).toBe(requested);
    },
  );

  it("sets the Forecast parts through the parts property", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));
    const widget = document.createElement("weather-widget");

    widget.latitude = 52.03;
    widget.longitude = 5.08;
    widget.parts = "daily";
    document.body.append(widget);
    nearViewport(widget);

    await expect.element(dailyForecast()).toBeVisible();
    expect(requestedUrls()[0]?.searchParams.get("parts")).toBe("daily");
  });

  it("shows the new Forecast parts when the Host page changes them", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));
    const widget = renderWidget({ ...NIEUWEGEIN, parts: "current" });
    await expect.element(page.getByText("Feels like")).toBeVisible();

    widget.setAttribute("parts", "hourly");

    await expect.element(hourlyForecast()).toBeVisible();
    expect(page.getByText("Feels like").query()).toBeNull();
    expect(requestedUrls()[1]?.searchParams.get("parts")).toBe("hourly");
  });

  it('shows "Forecast unavailable" when the Proxy leaves out a requested Forecast part', async () => {
    const { location, parts } = forecastWith();
    fakeProxy.mockImplementation(() =>
      respondWith({ location, parts: { current: parts.current } }),
    );

    renderWidget({ ...NIEUWEGEIN, parts: "current daily" });

    await expect
      .element(announcement())
      .toHaveTextContent("Forecast unavailable");
  });

  it.each([
    ["current", "Current conditions unavailable", "hourly,daily"],
    ["hourly", "Hourly forecast unavailable", "current,daily"],
    ["daily", "Daily forecast unavailable", "current,hourly"],
  ] as const)(
    "replaces only a failed %s part with a short message",
    async (failed, message, stillShown) => {
      fakeProxy.mockImplementation(() => respondWith(forecastFailing(failed)));

      renderWidget(NIEUWEGEIN);

      await expect.element(shownMessage(message)).toBeVisible();
      expect(shownParts()).toBe(stillShown);
      expect(
        page.getByRole("button", { name: "Try again" }).query(),
      ).toBeNull();
    },
  );

  it.each([
    ["hourly", "Next 12 hours"],
    ["daily", "Next 5 days"],
  ] as const)(
    "keeps the heading of a failed %s part",
    async (failed, heading) => {
      fakeProxy.mockImplementation(() => respondWith(forecastFailing(failed)));

      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByRole("heading", { name: heading }))
        .toBeVisible();
    },
  );

  it("announces each failed part with the Forecast", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastFailing("hourly", "daily")),
    );

    renderWidget(NIEUWEGEIN);

    await expect
      .element(announcement())
      .toHaveTextContent(
        "Forecast for Nieuwegein, updated at 10:41 AM. Hourly forecast unavailable. Daily forecast unavailable",
      );
  });

  it("announces the Forecast without an update time when Current conditions failed", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastFailing("current")));

    renderWidget(NIEUWEGEIN);

    await expect
      .element(announcement())
      .toHaveTextContent(
        /^Forecast for Nieuwegein\. Current conditions unavailable$/,
      );
  });

  it('shows "Forecast unavailable" and "Try again" when every requested part failed', async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastFailing("hourly", "daily")),
    );

    renderWidget({ ...NIEUWEGEIN, parts: "hourly daily" });

    await expect
      .element(page.getByRole("button", { name: "Try again" }))
      .toBeVisible();
    await expect
      .element(announcement())
      .toHaveTextContent("Forecast unavailable");
  });

  it("credits OpenWeather without Current conditions, with no update time", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget({ ...NIEUWEGEIN, parts: "daily" });

    await expect.element(weatherProviderCredit()).toBeVisible();
    expect(
      shownMessage("Weather data provided by OpenWeather").element(),
    ).toHaveTextContent(/^\s*Weather data provided by OpenWeather\s*$/);
  });
});
