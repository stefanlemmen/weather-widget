import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

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
const SLOW_MODULE_DELAY_MS = 1000;
const LAYOUT_SHIFT_KEY = "layoutShift";
const ZOOM_LEVELS = [
  { zoom: "200%", width: DESKTOP_WIDTH / 2 },
  { zoom: "400%", width: DESKTOP_WIDTH / 4 },
];
const PRODUCTION_ORIGIN = "https://weather-widget-ruby-delta.vercel.app";

const WIDGET_MODULE_PATH = "/widget/weather-widget.js";
const PICKER_MODULE_PATH = "/location-picker/weather-location-picker.js";
const STANDALONE_MODULE_PATHS = [WIDGET_MODULE_PATH, PICKER_MODULE_PATH];

const CHOSEN_LOCATION_CAPTION = "Choose a Location to show it in this Widget.";
const DUTCH_CAPTION = 'Dutch: locale="nl"';
const IMPERIAL_CAPTION = 'Imperial units: units="imperial"';
const THEMED_CAPTION = "Themed with five CSS custom properties";

const VANILLA_HOST = {
  name: "vanilla",
  path: "/vanilla/",
  title: "Weather Widget in plain HTML",
  modules: "**/weather-*.js",
};
const REACT_HOST = {
  name: "React",
  path: "/react/",
  title: "Weather Widget in React",
  modules: "**/react/assets/*.js",
};
const ANGULAR_HOST = {
  name: "Angular",
  path: "/angular/",
  title: "Weather Widget in Angular",
  modules: "**/angular/main-*.js",
};
const FRAMEWORK_HOSTS = [REACT_HOST, ANGULAR_HOST];
const EXAMPLE_HOSTS = [VANILLA_HOST, ...FRAMEWORK_HOSTS];
const SHOWCASE_HOSTS = EXAMPLE_HOSTS;

const themeOf = (component: Locator) =>
  component.evaluate((host) => {
    const style = getComputedStyle(host);
    const link = host.shadowRoot?.querySelector("a");
    return {
      font: style.fontFamily,
      background: style.backgroundColor,
      ink: style.color,
      accent: link ? getComputedStyle(link).color : null,
      radius: style.borderTopLeftRadius,
    };
  });

const showcaseWidget = (page: Page, caption: string) =>
  page.getByRole("figure", { name: caption }).locator("weather-widget");

for (const host of EXAMPLE_HOSTS) {
  const showEveryWidget = async (page: Page) => {
    await page.goto(host.path);
    for (const widget of await page.locator("weather-widget").all()) {
      await widget.scrollIntoViewIfNeeded();
      await expect(widget.getByRole("heading", { level: 2 })).toBeVisible();
    }
  };

  test.describe(`the ${host.name} Example host`, () => {
    test("describes itself for search engines and link previews", async ({
      page,
    }) => {
      const pageUrl = `${PRODUCTION_ORIGIN}${host.path}`;

      await page.goto(host.path);

      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page).toHaveTitle(host.title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        "content",
        /\S/,
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        host.title,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        pageUrl,
      );
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
        "content",
        pageUrl,
      );
      await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
        "content",
        host.title,
      );
    });

    test("shows the Current conditions for the Widget's Location", async ({
      page,
    }) => {
      await page.goto(host.path);
      const widget = page.locator("weather-widget").first();

      await expect(
        widget.getByRole("heading", {
          level: 2,
          name: RECORDED_NIEUWEGEIN_NAME,
        }),
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

    test("shows the Hourly and Daily forecast in the Location's local time", async ({
      page,
    }) => {
      await page.clock.setFixedTime(RECORDED_AT);
      await page.goto(host.path);

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

    test("keeps the page still while its modules load slowly", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.route(host.modules, async (route) => {
        await new Promise((resolve) =>
          setTimeout(resolve, SLOW_MODULE_DELAY_MS),
        );
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

      await page.goto(host.path);
      await expect(
        page
          .locator("weather-widget")
          .first()
          .getByRole("heading", { level: 2 }),
      ).toBeVisible();

      const layoutShift = await page.evaluate((key) => {
        const measured: unknown = Reflect.get(window, key);
        return typeof measured === "number" ? measured : 0;
      }, LAYOUT_SHIFT_KEY);
      expect(layoutShift).toBeLessThanOrEqual(GOOD_LAYOUT_SHIFT);
    });

    test("keeps the Location picker and the Widgets apart", async ({
      page,
    }) => {
      await page.goto(host.path);
      await expect(
        page
          .locator("weather-widget")
          .first()
          .getByRole("heading", { level: 2 }),
      ).toBeVisible();

      const components = page.locator(
        "weather-location-picker, weather-widget",
      );
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
      test(`passes axe in the ${colorScheme} scheme with every Widget shown`, async ({
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
        await page.goto(host.path);

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
          chosenLocation(page).getByRole("heading", {
            level: 2,
            name: "Paris",
          }),
        ).toBeVisible();
      });

      test("announces a search that finds nothing", async ({ page }) => {
        await page.goto(host.path);

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
        await page.goto(host.path);
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

      test("drops a searched name once the top Widget gets the device's Location", async ({
        page,
        context,
      }) => {
        await context.grantPermissions(["geolocation"]);
        await context.setGeolocation({ latitude: 48.85341, longitude: 2.3488 });
        await page.goto(host.path);
        await picker(page)
          .getByRole("searchbox", { name: "Location" })
          .fill("Paris");
        await picker(page).getByRole("button", { name: "Search" }).click();
        await picker(page)
          .getByRole("button", { name: "Paris Texas, United States" })
          .click();
        await expect(
          chosenLocation(page).getByRole("heading", {
            level: 2,
            name: "Paris",
          }),
        ).toBeVisible();

        await picker(page)
          .getByRole("button", { name: "Use my location" })
          .click();

        await expect(
          chosenLocation(page).getByRole("heading", {
            level: 2,
            name: RECORDED_NIEUWEGEIN_NAME,
          }),
        ).toBeVisible();
      });

      for (const colorScheme of ["light", "dark"] as const) {
        test(`falls back to the same theme as the Widget in the ${colorScheme} scheme`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme });
          await page.goto(host.path);
          const widget = chosenLocation(page);
          await expect(widget.getByRole("heading", { level: 2 })).toBeVisible();

          const widgetTheme = await themeOf(widget);

          expect(widgetTheme.accent).not.toBeNull();
          expect(await themeOf(picker(page))).toEqual(widgetTheme);
        });
      }
    });
  });
}

for (const host of SHOWCASE_HOSTS) {
  test.describe(`the ${host.name} Example host's fixed showcase`, () => {
    test("shows a Dutch Widget", async ({ page }) => {
      await page.clock.setFixedTime(RECORDED_AT);
      await page.goto(host.path);
      const widget = showcaseWidget(page, DUTCH_CAPTION);
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
      await page.goto(host.path);
      const widget = showcaseWidget(page, IMPERIAL_CAPTION);
      await widget.scrollIntoViewIfNeeded();

      await expect(
        widget
          .getByText(RECORDED_NIEUWEGEIN_TEMPERATURE_FAHRENHEIT, {
            exact: true,
          })
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

      await page.goto(host.path);
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

    test("shows one Widget themed through its style attribute", async ({
      page,
    }) => {
      await page.goto(host.path);
      const themed = page.locator("weather-widget[style]");
      await themed.scrollIntoViewIfNeeded();

      await expect(themed).toHaveCount(1);
      await expect(themed.getByRole("heading", { level: 2 })).toBeVisible();
      await expect(themed).toHaveCSS("background-color", "rgb(255, 250, 242)");
      await expect(themed).toHaveCSS("color", "rgb(43, 29, 22)");
      await expect(themed.getByRole("link", { name: "OpenWeather" })).toHaveCSS(
        "color",
        "rgb(156, 52, 18)",
      );
    });

    test("names each example Widget in a caption", async ({ page }) => {
      await page.goto(host.path);

      for (const caption of [
        CHOSEN_LOCATION_CAPTION,
        DUTCH_CAPTION,
        IMPERIAL_CAPTION,
        THEMED_CAPTION,
      ]) {
        await expect(showcaseWidget(page, caption)).toHaveCount(1);
      }
    });
  });
}

test.describe("the vanilla Example host's standalone modules", () => {
  test("loads the Widget as one standalone ES module from a stable URL and asks the same-origin Proxy", async ({
    page,
    baseURL,
  }) => {
    const widgetModule = page.waitForResponse(`**${WIDGET_MODULE_PATH}`);
    const forecast = page.waitForResponse("**/api/forecast?**");

    await page.goto(VANILLA_HOST.path);

    expect((await widgetModule).status()).toBe(200);
    const forecastResponse = await forecast;
    expect(forecastResponse.status()).toBe(200);
    expect(new URL(forecastResponse.url()).origin).toBe(baseURL);
  });

  test("ships the Meteocons licence inside the Widget's module", async ({
    request,
  }) => {
    const widgetModule = await request.get(WIDGET_MODULE_PATH);

    const source = await widgetModule.text();
    expect(source).toContain("Copyright (c) 2020-present Bas Milius");
    expect(source).toContain("Permission is hereby granted, free of charge");
  });

  test("serves the Widget's module compressed, as production does", async ({
    request,
  }) => {
    const widgetModule = await request.get(WIDGET_MODULE_PATH, {
      headers: { "accept-encoding": "gzip" },
    });

    expect(widgetModule.headers()["content-encoding"]).toBe("gzip");
  });

  test("loads the Location picker as its own standalone ES module from its own path", async ({
    page,
  }) => {
    const pickerModule = page.waitForResponse(PICKER_MODULE_PATH);

    await page.goto(VANILLA_HOST.path);

    expect((await pickerModule).status()).toBe(200);
  });

  test("ships the Lucide licence inside the Location picker's module", async ({
    request,
  }) => {
    const pickerModule = await request.get(PICKER_MODULE_PATH);

    expect(await pickerModule.text()).toContain(
      "Lucide Icons and Contributors",
    );
  });
});

for (const host of FRAMEWORK_HOSTS) {
  test.describe(`the ${host.name} Example host's imported packages`, () => {
    test("bundles the Widget and the Location picker instead of loading their standalone modules", async ({
      page,
      baseURL,
    }) => {
      const requestedPaths: string[] = [];
      page.on("request", (request) => {
        requestedPaths.push(new URL(request.url()).pathname);
      });
      const forecast = page.waitForResponse("**/api/forecast?**");

      await page.goto(host.path);

      const forecastResponse = await forecast;
      expect(forecastResponse.status()).toBe(200);
      expect(new URL(forecastResponse.url()).origin).toBe(baseURL);
      await expect(page.locator("weather-location-picker")).toHaveCount(1);
      expect(
        requestedPaths.filter((path) => STANDALONE_MODULE_PATHS.includes(path)),
      ).toEqual([]);
    });

    test("ships the Meteocons and Lucide licences inside its bundle", async ({
      page,
      request,
    }) => {
      await page.goto(host.path);
      const bundleUrl = await page
        .locator('script[type="module"]')
        .evaluate((script) =>
          script instanceof HTMLScriptElement ? script.src : null,
        );
      expect(bundleUrl).not.toBeNull();

      const bundle = await (await request.get(bundleUrl ?? "")).text();

      expect(bundle).toContain("Copyright (c) 2020-present Bas Milius");
      expect(bundle).toContain("Lucide Icons and Contributors");
    });
  });
}
