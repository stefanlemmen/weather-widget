import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const RECORDED_NIEUWEGEIN_TEMPERATURE = "9°";
const RECORDED_NIEUWEGEIN_NAME = "Nieuwegein";
const RECORDED_AT = new Date("2026-11-08T09:41:44Z");
const RECORDED_NIEUWEGEIN_TEMPERATURE_FAHRENHEIT = "48°";
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const DESKTOP_WIDTH = 1280;
const SHOWN_PARTS = "h2, h3, p, li, dt, dd, a, button, .icon";
const VIEWPORT_HEIGHT = 800;
const ZOOM_LEVELS = [
  { zoom: "200%", width: DESKTOP_WIDTH / 2 },
  { zoom: "400%", width: DESKTOP_WIDTH / 4 },
];

const showEveryWidget = async (page: Page) => {
  await page.goto("/vanilla/");
  for (const widget of await page.locator("weather-widget").all()) {
    await widget.scrollIntoViewIfNeeded();
    await expect(widget.getByRole("heading", { level: 2 })).toBeVisible();
  }
};

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
    await expect(widgets).toHaveCount(4);
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

  test("shows one Widget themed through its style attribute", async ({
    page,
  }) => {
    await page.goto("/vanilla/");
    const themed = page.locator("weather-widget[style]");
    await themed.scrollIntoViewIfNeeded();

    await expect(themed.getByRole("heading", { level: 2 })).toBeVisible();
    await expect(themed).toHaveCSS("background-color", "rgb(255, 250, 242)");
    await expect(themed).toHaveCSS("color", "rgb(43, 29, 22)");
    await expect(themed.getByRole("link", { name: "OpenWeather" })).toHaveCSS(
      "color",
      "rgb(156, 52, 18)",
    );
  });

  test("draws its Widgets in the self-hosted Lexend", async ({ page }) => {
    const font = page.waitForResponse(
      "**/vanilla/fonts/lexend-latin-wght.woff2",
    );

    await page.goto("/vanilla/");

    expect((await font).status()).toBe(200);
    await expect(page.locator("weather-widget").first()).toHaveCSS(
      "font-family",
      /^Lexend/,
    );
  });

  for (const colorScheme of ["light", "dark"] as const) {
    test(`passes axe in the ${colorScheme} scheme, the themed Widget included`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await showEveryWidget(page);

      const results = await new AxeBuilder({ page })
        .withTags(WCAG_AA_TAGS)
        .analyze();

      expect(results.violations).toEqual([]);
    });
  }

  for (const { zoom, width } of ZOOM_LEVELS) {
    test(`keeps everything inside each Widget at ${zoom} zoom`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await showEveryWidget(page);

      const cutOff: string[] = [];
      for (const widget of await page.locator("weather-widget").all()) {
        const bounds = await widget.boundingBox();
        expect(bounds).not.toBeNull();
        if (!bounds) continue;
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        for (const part of await widget.locator(SHOWN_PARTS).all()) {
          const box = await part.boundingBox();
          if (
            box &&
            box.width > 1 &&
            (box.x < Math.floor(bounds.x) ||
              box.x + box.width > Math.ceil(bounds.x + bounds.width))
          ) {
            cutOff.push(await part.innerText());
          }
        }
      }

      expect(cutOff).toEqual([]);
    });
  }
});
