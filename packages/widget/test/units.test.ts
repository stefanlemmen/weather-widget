import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  NIEUWEGEIN,
  forecastWith,
  fullForecast,
  forecastWithTemperature,
  locationName,
  respondWith,
  fakeProxy,
  requestedUrls,
  renderWidget,
  hourlyForecast,
  dailyForecast,
} from "./support.ts";

describe("units", () => {
  const IMPERIAL = { ...NIEUWEGEIN, units: "imperial" };

  it("converts temperatures to Fahrenheit and wind speed to miles per hour", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(IMPERIAL);

    await expect.element(page.getByText("48°F")).toBeVisible();
    expect(
      page.getByText("Feels like").element().nextElementSibling,
    ).toHaveTextContent("44°F");
    expect(
      page.getByText("Wind", { exact: true }).element().nextElementSibling,
    ).toHaveTextContent("7 mph SSW");
    expect(
      hourlyForecast().getByRole("listitem").elements()[0],
    ).toHaveTextContent(/10 AM.*87°F/);
    expect(
      dailyForecast().getByRole("listitem").elements()[0],
    ).toHaveTextContent(/Low\s*69°F.*High\s*123°F/);
  });

  it("writes negative temperatures with a true minus sign in either unit", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastWithTemperature(-20.6)),
    );

    renderWidget(IMPERIAL);

    await expect.element(page.getByText("−5°F")).toBeVisible();
    expect(page.getByText("-5°F").query()).toBeNull();
  });

  it("tells screen readers the imperial units in full", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWith()));

    renderWidget(IMPERIAL);

    await expect
      .element(page.getByText("48 degrees Fahrenheit"))
      .toBeInTheDocument();
    expect(
      page.getByText("7 miles per hour from the south-southwest").query(),
    ).not.toBeNull();
  });

  it.each([
    ["Calm under half a mile per hour", 0.22, "Calm"],
    ["1 mph from half a mile per hour", 0.23, "1 mph SSW"],
  ])("shows %s", async (_, windSpeedMetresPerSecond, shown) => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastWith({ windSpeedMetresPerSecond })),
    );

    renderWidget(IMPERIAL);

    await expect.element(locationName()).toBeVisible();
    expect(
      page.getByText("Wind", { exact: true }).element().nextElementSibling,
    ).toHaveTextContent(shown);
  });

  it("combines imperial units with the Dutch locale", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWith()));

    renderWidget({ ...IMPERIAL, locale: "nl" });

    await expect
      .element(page.getByText("48 graden Fahrenheit"))
      .toBeInTheDocument();
    expect(
      page.getByText("Wind", { exact: true }).element().nextElementSibling,
    ).toHaveTextContent("7 mi/h ZZW");
  });

  it.each([
    ["absent", {}],
    ["unsupported", { units: "kelvin" }],
    ["in capitals", { units: "IMPERIAL" }],
    ["empty", { units: "" }],
  ])("shows metric units when units is %s", async (_, attributes) => {
    fakeProxy.mockImplementation(() => respondWith(forecastWith()));

    renderWidget({ ...NIEUWEGEIN, ...attributes });

    await expect.element(page.getByText("9°C")).toBeVisible();
  });

  it("converts without asking the Proxy again when the Host page changes the units", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWith()));
    const widget = renderWidget(NIEUWEGEIN);
    await expect.element(page.getByText("9°C")).toBeVisible();

    widget.setAttribute("units", "imperial");

    await expect.element(page.getByText("48°F")).toBeVisible();
    expect(fakeProxy).toHaveBeenCalledOnce();
  });
});

describe("the Proxy request", () => {
  it("is the same for Widgets that differ only in locale and units, so they share one cache entry", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWith()));

    for (const locale of ["en", "nl"]) {
      for (const units of ["metric", "imperial"]) {
        renderWidget({ ...NIEUWEGEIN, locale, units });
      }
    }

    await vi.waitFor(() => {
      expect(fakeProxy).toHaveBeenCalledTimes(4);
    });
    expect(new Set(requestedUrls().map((url) => url.href)).size).toBe(1);
    expect([...(requestedUrls()[0]?.searchParams.keys() ?? [])]).toEqual([
      "latitude",
      "longitude",
      "parts",
    ]);
  });
});
