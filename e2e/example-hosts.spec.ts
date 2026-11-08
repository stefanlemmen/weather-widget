import { expect, test } from "@playwright/test";

const RECORDED_NIEUWEGEIN_TEMPERATURE = "9°C";
const RECORDED_NIEUWEGEIN_NAME = "Nieuwegein";
const RECORDED_AT = new Date("2026-11-08T09:41:44Z");

test.describe("the vanilla Example host", () => {
  test("shows the Current conditions for the Widget's Location", async ({
    page,
  }) => {
    await page.goto("/vanilla/");

    await expect(
      page.getByRole("heading", { level: 2, name: RECORDED_NIEUWEGEIN_NAME }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .getByText(RECORDED_NIEUWEGEIN_TEMPERATURE, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Feels like")).toBeVisible();
    await expect(page.getByRole("link", { name: "OpenWeather" })).toBeVisible();
  });

  test("shows the Hourly and Daily forecast in the Location's local time", async ({
    page,
  }) => {
    await page.clock.setFixedTime(RECORDED_AT);
    await page.goto("/vanilla/");

    const hours = page
      .getByRole("list", { name: "Next 12 hours" })
      .getByRole("listitem");
    const days = page
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
});
