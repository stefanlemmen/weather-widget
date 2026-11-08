import { expect, test } from "@playwright/test";

const RECORDED_NIEUWEGEIN_TEMPERATURE = "9°";
const RECORDED_NIEUWEGEIN_NAME = "Nieuwegein";
const RECORDED_AT = new Date("2026-11-08T09:41:44Z");
const RECORDED_NIEUWEGEIN_TEMPERATURE_FAHRENHEIT = "48°";

test.describe("the vanilla Example host", () => {
  test("shows the Current conditions for the Widget's Location", async ({
    page,
  }) => {
    await page.goto("/vanilla/");
    const widget = page.locator("weather-widget").first();

    await expect(
      widget.getByRole("heading", { level: 2, name: RECORDED_NIEUWEGEIN_NAME }),
    ).toBeVisible();
    await expect(widget.getByRole("status")).toContainText(
      `Forecast for ${RECORDED_NIEUWEGEIN_NAME}`,
    );
    await expect(
      widget
        .getByText(RECORDED_NIEUWEGEIN_TEMPERATURE, { exact: true })
        .first(),
    ).toBeVisible();
    await expect(widget.getByText("Feels like")).toBeVisible();
    await expect(
      widget.getByRole("link", { name: "OpenWeather" }),
    ).toBeVisible();
  });

  test("shows a Dutch Widget", async ({ page }) => {
    await page.clock.setFixedTime(RECORDED_AT);
    await page.goto("/vanilla/");
    const widget = page.locator('weather-widget[locale="nl"]');
    await widget.scrollIntoViewIfNeeded();

    await expect(widget.getByRole("status")).toContainText(
      `Weersverwachting voor ${RECORDED_NIEUWEGEIN_NAME}`,
    );
    await expect(widget.getByText("Gevoelstemperatuur")).toBeVisible();
    await expect(
      widget
        .getByRole("list", { name: "Komende 5 dagen" })
        .getByRole("listitem")
        .first(),
    ).toContainText("zo");
  });

  test("shows an imperial Widget", async ({ page }) => {
    await page.goto("/vanilla/");
    const widget = page.locator('weather-widget[units="imperial"]');
    await widget.scrollIntoViewIfNeeded();

    await expect(
      widget
        .getByText(RECORDED_NIEUWEGEIN_TEMPERATURE_FAHRENHEIT, { exact: true })
        .first(),
    ).toBeVisible();
  });

  test("asks the Proxy one shared request for Widgets that differ only in locale and units", async ({
    page,
  }) => {
    const forecastUrls: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/forecast") {
        forecastUrls.push(request.url());
      }
    });

    await page.goto("/vanilla/");
    const widgets = page.locator("weather-widget");
    await expect(widgets).toHaveCount(3);
    for (const widget of await widgets.all()) {
      await widget.scrollIntoViewIfNeeded();
    }
    await expect
      .poll(() => forecastUrls.length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(3);

    expect(new Set(forecastUrls).size).toBe(1);
  });

  test("shows the Hourly and Daily forecast in the Location's local time", async ({
    page,
  }) => {
    await page.clock.setFixedTime(RECORDED_AT);
    await page.goto("/vanilla/");

    const widget = page.locator("weather-widget").first();
    const hours = widget
      .getByRole("list", { name: "Next 12 hours" })
      .getByRole("listitem");
    const days = widget
      .getByRole("list", { name: "Next 5 days" })
      .getByRole("listitem");
    await expect(hours).toHaveCount(12);
    await expect(hours.first()).toContainText("10 AM");
    await expect(days).toHaveCount(5);
    await expect(days.first()).toContainText("Sun");
  });

  test("loads the Widget as one standalone ES module from a stable URL and asks the same-origin Proxy", async ({
    page,
    baseURL,
  }) => {
    const widgetModule = page.waitForResponse("**/widget/weather-widget.js");
    const forecast = page.waitForResponse("**/api/forecast?**");

    await page.goto("/vanilla/");

    expect((await widgetModule).status()).toBe(200);
    const forecastResponse = await forecast;
    expect(forecastResponse.status()).toBe(200);
    expect(new URL(forecastResponse.url()).origin).toBe(baseURL);
  });

  test("ships the Meteocons licence inside the Widget's module", async ({
    request,
  }) => {
    const widgetModule = await request.get("/widget/weather-widget.js");

    const source = await widgetModule.text();
    expect(source).toContain("Copyright (c) 2020-present Bas Milius");
    expect(source).toContain("Permission is hereby granted, free of charge");
  });

  test("serves the Widget's module compressed, as production does", async ({
    request,
  }) => {
    const widgetModule = await request.get("/widget/weather-widget.js", {
      headers: { "accept-encoding": "gzip" },
    });

    expect(widgetModule.headers()["content-encoding"]).toBe("gzip");
  });
});
