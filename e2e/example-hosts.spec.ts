import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const RECORDED_NIEUWEGEIN_TEMPERATURE = "9°";
const RECORDED_NIEUWEGEIN_NAME = "Nieuwegein";
const RECORDED_AT = new Date("2026-11-08T09:41:44Z");
const RECORDED_NIEUWEGEIN_TEMPERATURE_FAHRENHEIT = "48°";
const WCAG_AA_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const DESKTOP_WIDTH = 1280;
const SHOWN_PARTS = "h2, h3, p, li, dt, dd, a, button, input, label, .icon";
const VIEWPORT_HEIGHT = 800;
const MOBILE_VIEWPORT = { width: 412, height: 823 };
const GOOD_LAYOUT_SHIFT = 0.1;
const COMPONENT_MODULES = "**/weather-*.js";
const SLOW_MODULE_DELAY_MS = 1000;
const LAYOUT_SHIFT_KEY = "layoutShift";
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

  test("names each example Widget in a caption", async ({ page }) => {
    await page.goto("/vanilla/");

    for (const caption of [
      "Choose a Location to show it in this Widget.",
      'Dutch: locale="nl"',
      'Imperial units: units="imperial"',
      "Themed with five CSS custom properties",
    ]) {
      await expect(
        page.getByRole("figure", { name: caption }).locator("weather-widget"),
      ).toHaveCount(1);
    }
  });

  test("keeps the page still while its modules load slowly", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.route(COMPONENT_MODULES, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, SLOW_MODULE_DELAY_MS));
      await route.continue();
    });
    await page.addInitScript((key) => {
      let layoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if ("value" in entry && typeof entry.value === "number") {
            layoutShift += entry.value;
          }
        }
        Reflect.set(window, key, layoutShift);
      }).observe({ type: "layout-shift", buffered: true });
    }, LAYOUT_SHIFT_KEY);

    await page.goto("/vanilla/");
    await expect(
      page.locator("weather-widget").first().getByRole("heading", { level: 2 }),
    ).toBeVisible();

    const layoutShift = await page.evaluate((key) => {
      const measured: unknown = Reflect.get(window, key);
      return typeof measured === "number" ? measured : 0;
    }, LAYOUT_SHIFT_KEY);
    expect(layoutShift).toBeLessThanOrEqual(GOOD_LAYOUT_SHIFT);
  });

  test("keeps the Location picker and the Widgets apart", async ({ page }) => {
    await page.goto("/vanilla/");

    const components = page.locator("weather-location-picker, weather-widget");
    await expect(components).toHaveCount(5);
    const bounds = await Promise.all(
      (await components.all()).map(async (component) => {
        const box = await component.boundingBox();
        if (!box) throw new Error("A component isn't shown");
        return box;
      }),
    );
    const touching = bounds.flatMap((one, index) =>
      bounds
        .slice(index + 1)
        .filter(
          (other) =>
            one.x <= other.x + other.width &&
            other.x <= one.x + one.width &&
            one.y <= other.y + other.height &&
            other.y <= one.y + one.height,
        ),
    );
    expect(touching).toEqual([]);
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
    test(`keeps everything inside each Widget and the Location picker at ${zoom} zoom`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
      await showEveryWidget(page);

      const cutOff: string[] = [];
      for (const widget of await page
        .locator("weather-widget, weather-location-picker")
        .all()) {
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

  test.describe("its Location picker", () => {
    const chosenLocation = (page: Page) =>
      page.locator("weather-widget").first();
    const picker = (page: Page) => page.locator("weather-location-picker");
    const forecastRequestAt = (page: Page, latitude: string) =>
      page.waitForRequest((request) => {
        const url = new URL(request.url());
        return (
          url.pathname === "/api/forecast" &&
          url.searchParams.get("latitude") === latitude
        );
      });

    test("drives the top Widget, which starts on Nieuwegein", async ({
      page,
    }) => {
      await page.goto("/vanilla/");

      await expect(
        chosenLocation(page).getByRole("heading", {
          level: 2,
          name: RECORDED_NIEUWEGEIN_NAME,
        }),
      ).toBeVisible();

      await picker(page)
        .getByRole("searchbox", { name: "Location" })
        .fill("Paris");
      await picker(page).getByRole("button", { name: "Search" }).click();
      const forecast = forecastRequestAt(page, "33.66094");
      await picker(page)
        .getByRole("button", { name: "Paris Texas, United States" })
        .click();

      const url = new URL((await forecast).url());
      expect(url.searchParams.get("longitude")).toBe("-95.55551");
      await expect(
        chosenLocation(page).getByRole("heading", { level: 2, name: "Paris" }),
      ).toBeVisible();
    });

    test("announces a search that finds nothing", async ({ page }) => {
      await page.goto("/vanilla/");

      await picker(page)
        .getByRole("searchbox", { name: "Location" })
        .fill("Atlantis");
      await picker(page).getByRole("button", { name: "Search" }).click();

      await expect(picker(page).getByRole("status")).toHaveText(
        "No locations found for “Atlantis”. Check the spelling or try a nearby town.",
      );
    });

    test("sends the top Widget the device's Location rounded to 2 decimals", async ({
      page,
      context,
    }) => {
      await context.grantPermissions(["geolocation"]);
      await context.setGeolocation({ latitude: 48.85341, longitude: 2.3488 });
      await page.goto("/vanilla/");
      await expect(
        chosenLocation(page).getByRole("heading", {
          level: 2,
          name: RECORDED_NIEUWEGEIN_NAME,
        }),
      ).toBeVisible();

      const forecast = forecastRequestAt(page, "48.85");
      await picker(page)
        .getByRole("button", { name: "Use my location" })
        .click();

      expect(
        new URL((await forecast).url()).searchParams.get("longitude"),
      ).toBe("2.35");
    });

    test("loads as its own standalone ES module, which the Widget's module leaves out", async ({
      page,
      request,
    }) => {
      const pickerModule = page.waitForResponse(
        "**/widget/weather-location-picker.js",
      );

      await page.goto("/vanilla/");

      expect((await pickerModule).status()).toBe(200);
      const widgetModule = await request.get("/widget/weather-widget.js");
      expect(await widgetModule.text()).not.toContain(
        "weather-location-picker",
      );
    });

    test("ships the Lucide licence inside its module", async ({ request }) => {
      const pickerModule = await request.get(
        "/widget/weather-location-picker.js",
      );

      expect(await pickerModule.text()).toContain(
        "Lucide Icons and Contributors",
      );
    });
  });
});
