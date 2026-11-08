import { expect, test } from "@playwright/test";

const RECORDED_NIEUWEGEIN_TEMPERATURE = "9°C";
const RECORDED_NIEUWEGEIN_NAME = "Nieuwegein";

test.describe("the vanilla Example host", () => {
  test("shows the Current conditions for the Widget's Location", async ({
    page,
  }) => {
    await page.goto("/vanilla/");

    await expect(
      page.getByRole("heading", { level: 2, name: RECORDED_NIEUWEGEIN_NAME }),
    ).toBeVisible();
    await expect(
      page.getByText(RECORDED_NIEUWEGEIN_TEMPERATURE, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Feels like")).toBeVisible();
    await expect(page.getByRole("link", { name: "OpenWeather" })).toBeVisible();
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
