import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

const RECORDED_NIEUWEGEIN_TEMPERATURE = "9°";
const RECORDED_NIEUWEGEIN_NAME = "Nieuwegein";
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

const DAILY_FORECAST_LIST = "Next 5 days";
const FORECAST_PARTS_HINT =
  "The Widget always shows at least one Forecast part.";
const THEMED_PRESET_NAME = "Georgia and rust";
const THEMED_PRESET_COLORS = {
  light: {
    background: "rgb(255, 250, 242)",
    ink: "rgb(43, 29, 22)",
    accent: "rgb(156, 52, 18)",
  },
  dark: {
    background: "rgb(33, 24, 20)",
    ink: "rgb(246, 237, 226)",
    accent: "rgb(240, 147, 106)",
  },
};
const DEFAULT_BACKGROUNDS = {
  light: "rgb(238, 243, 249)",
  dark: "rgb(22, 38, 59)",
};
const DEFAULT_WIDTH = 390;
const TOP_RIGHT_TOLERANCE = 32;
const WIDEST_WIDTH = 760;
const WIDE_SCREEN_WIDTHS = [1024, DESKTOP_WIDTH];
const onlyWidthStyle = (width: number) =>
  new RegExp(`^inline-size: ${String(width)}px;?$`);
const DEFAULT_WIDTH_STYLE = onlyWidthStyle(DEFAULT_WIDTH);
const COLOR_SCHEMES = [
  { scheme: "light", name: "Light", other: "dark" },
  { scheme: "dark", name: "Dark", other: "light" },
] as const;

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

const widgetSettings = (page: Page) =>
  page.getByRole("form", { name: "Widget settings" });
const settingsToggle = (page: Page) =>
  page.locator("summary").filter({
    has: page.getByRole("heading", { level: 2, name: "Widget settings" }),
  });
const settingsPanel = (page: Page) =>
  page.locator("details").filter({ has: widgetSettings(page) });
const controlledWidget = (page: Page) => page.locator("weather-widget").first();
const forecastParts = (page: Page) =>
  widgetSettings(page).getByRole("group", { name: "Forecast parts" });
const settingsRadio = (page: Page, group: string, name: string) =>
  widgetSettings(page)
    .getByRole("group", { name: group })
    .getByRole("radio", { name });
const themedPreset = (page: Page) =>
  settingsRadio(page, "Theme", THEMED_PRESET_NAME);

const widthRadio = (page: Page, width: number) =>
  settingsRadio(page, "Width", `${String(width)} pixels`);

const boxOf = async (locator: Locator) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error("A part of the page isn't shown");
  return box;
};

type Box = Awaited<ReturnType<typeof boxOf>>;

const overlap = (one: Box, other: Box) =>
  one.x < other.x + other.width &&
  other.x < one.x + one.width &&
  one.y < other.y + other.height &&
  other.y < one.y + one.height;

const expectColors = async (
  widget: Locator,
  { background, ink, accent }: Record<"background" | "ink" | "accent", string>,
) => {
  await expect(widget).toHaveCSS("background-color", background);
  await expect(widget).toHaveCSS("color", ink);
  await expect(widget.getByRole("link", { name: "OpenWeather" })).toHaveCSS(
    "color",
    accent,
  );
};

const partsOf = (widget: Locator) =>
  widget.evaluate(async (element) => {
    await customElements.whenDefined(element.localName);
    return "parts" in element ? (element.parts ?? null) : undefined;
  });

const expectParts = (widget: Locator, parts: string | null) =>
  expect.poll(() => partsOf(widget)).toBe(parts);

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

    test("shows the Current weather for the Widget's Location", async ({
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
          controlledWidget(page).getByRole("heading", {
            level: 2,
            name: RECORDED_NIEUWEGEIN_NAME,
          }),
        ).toBeVisible();

        await picker(page)
          .getByRole("searchbox", { name: "Location" })
          .fill("Paris");
        await picker(page).getByRole("button", { name: "Search" }).click();
        const forecast = forecastRequestAt(page, "33.66");
        await picker(page)
          .getByRole("button", { name: "Paris Texas, United States" })
          .click();

        const url = new URL((await forecast).url());
        expect(url.searchParams.get("longitude")).toBe("-95.56");
        await expect(
          controlledWidget(page).getByRole("heading", {
            level: 2,
            name: "Paris",
          }),
        ).toBeVisible();
      });

      test("sends the top Widget the device's Location rounded to 2 decimals", async ({
        page,
        context,
      }) => {
        await context.grantPermissions(["geolocation"]);
        await context.setGeolocation({ latitude: 48.85341, longitude: 2.3488 });
        await page.goto(host.path);
        await expect(
          controlledWidget(page).getByRole("heading", {
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
          controlledWidget(page).getByRole("heading", {
            level: 2,
            name: "Paris",
          }),
        ).toBeVisible();

        await picker(page)
          .getByRole("button", { name: "Use my location" })
          .click();

        await expect(
          controlledWidget(page).getByRole("heading", {
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
          const widget = controlledWidget(page);
          await expect(widget.getByRole("heading", { level: 2 })).toBeVisible();

          const widgetTheme = await themeOf(widget);

          expect(widgetTheme.accent).not.toBeNull();
          expect(await themeOf(picker(page))).toEqual(widgetTheme);
        });
      }
    });
  });
}

for (const host of EXAMPLE_HOSTS) {
  test.describe(`the ${host.name} Example host's Widget settings`, () => {
    for (const screenWidth of WIDE_SCREEN_WIDTHS) {
      test(`sit at the top right of a ${String(screenWidth)} pixel screen, clear of the Location picker and the widest Widget`, async ({
        page,
      }) => {
        await page.setViewportSize({
          width: screenWidth,
          height: VIEWPORT_HEIGHT,
        });
        await page.goto(host.path);
        await widthRadio(page, WIDEST_WIDTH).check();
        await expect(
          controlledWidget(page).getByRole("heading", { level: 2 }),
        ).toBeVisible();

        const [panel, picker, widget] = await Promise.all([
          boxOf(settingsPanel(page)),
          boxOf(page.locator("weather-location-picker")),
          boxOf(controlledWidget(page)),
        ]);

        expect(panel.x + panel.width).toBeGreaterThanOrEqual(
          screenWidth - TOP_RIGHT_TOLERANCE,
        );
        expect(panel.y).toBeLessThanOrEqual(TOP_RIGHT_TOLERANCE);
        expect(overlap(panel, picker)).toBe(false);
        expect(overlap(panel, widget)).toBe(false);
      });
    }

    test("stay in view on a wide screen after scrolling to the end of the page", async ({
      page,
    }) => {
      await page.setViewportSize({
        width: DESKTOP_WIDTH,
        height: VIEWPORT_HEIGHT,
      });
      await page.goto(host.path);
      await expect(
        controlledWidget(page).getByRole("heading", { level: 2 }),
      ).toBeVisible();

      await page.keyboard.press("End");

      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBeGreaterThan(0);
      await expect(settingsPanel(page)).toBeInViewport({ ratio: 1 });
    });

    test("start open and collapse and expand with the mouse and the keyboard", async ({
      page,
    }) => {
      await page.goto(host.path);
      const toggle = settingsToggle(page);
      await expect(widgetSettings(page)).toBeVisible();

      await page.keyboard.press("Tab");
      await expect(toggle).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(widgetSettings(page)).toBeHidden();
      await expect(toggle).toBeFocused();

      await page.keyboard.press("Space");
      await expect(widgetSettings(page)).toBeVisible();

      await toggle.click();
      await expect(widgetSettings(page)).toBeHidden();

      await toggle.click();
      await expect(widgetSettings(page)).toBeVisible();
    });

    test("come right below the title on a phone, before the Location picker and the Widget", async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto(host.path);
      await expect(
        controlledWidget(page).getByRole("heading", { level: 2 }),
      ).toBeVisible();

      const tops = await Promise.all(
        [
          page.getByRole("heading", { level: 1 }),
          widgetSettings(page),
          page.locator("weather-location-picker"),
          controlledWidget(page),
        ].map(async (part) => (await boxOf(part)).y),
      );

      expect(tops).toEqual([...tops].sort((one, other) => one - other));
      expect(new Set(tops).size).toBe(tops.length);
    });

    test("keep each radio button and checkbox on one line with its label", async ({
      page,
    }) => {
      await page.goto(host.path);
      await expect(widgetSettings(page)).toBeVisible();

      const brokenLabels = await widgetSettings(page)
        .locator("label")
        .evaluateAll((labels) =>
          labels
            .filter((label) => label.getClientRects().length > 1)
            .map((label) => label.textContent.trim()),
        );

      expect(brokenLabels).toEqual([]);
    });

    test("start in sync with the Widget", async ({ page }) => {
      await page.goto(host.path);
      const settings = widgetSettings(page);

      await expect(
        settings
          .getByRole("group", { name: "Locale" })
          .getByRole("radio", { name: "English" }),
      ).toBeChecked();
      await expect(
        settings
          .getByRole("group", { name: "Units" })
          .getByRole("radio", { name: "Metric" }),
      ).toBeChecked();
      for (const name of [
        "Current weather",
        "Hourly forecast",
        "Daily forecast",
      ]) {
        await expect(
          forecastParts(page).getByRole("checkbox", { name }),
        ).toBeChecked();
      }
      await expectParts(controlledWidget(page), null);
      await expect(settingsRadio(page, "Theme", "None")).toBeChecked();
      await expect(settingsRadio(page, "Color scheme", "System")).toBeChecked();
      await expect(widthRadio(page, DEFAULT_WIDTH)).toBeChecked();
      await expect(controlledWidget(page)).toHaveAttribute(
        "style",
        DEFAULT_WIDTH_STYLE,
      );
      await expect(
        controlledWidget(page).getByText("Feels like"),
      ).toBeVisible();
    });

    for (const { scheme } of COLOR_SCHEMES) {
      test(`theme the Widget with the preset's ${scheme} colors in the ${scheme} scheme`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(host.path);
        const widget = controlledWidget(page);
        await expect(widget.getByRole("heading", { level: 2 })).toBeVisible();

        await themedPreset(page).check();

        await expectColors(widget, THEMED_PRESET_COLORS[scheme]);
        await expect(widget).toHaveCSS("font-family", "Georgia, serif");
        await expect(widget).toHaveCSS("border-top-left-radius", "0px");
        await expect(themedPreset(page)).toBeFocused();
      });

      test(`pass axe in the ${scheme} scheme with the themed preset on`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(host.path);
        await themedPreset(page).check();
        await expect(
          controlledWidget(page).getByRole("heading", { level: 2 }),
        ).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(WCAG_AA_TAGS)
          .analyze();

        expect(results.violations).toEqual([]);
      });
    }

    for (const { scheme, name, other } of COLOR_SCHEMES) {
      test(`force the ${scheme} scheme on the Widget on a ${other} device`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: other });
        await page.goto(host.path);
        const widget = controlledWidget(page);
        await expect(widget).toHaveCSS(
          "background-color",
          DEFAULT_BACKGROUNDS[other],
        );

        await settingsRadio(page, "Color scheme", name).check();

        await expect(widget).toHaveCSS(
          "background-color",
          DEFAULT_BACKGROUNDS[scheme],
        );
        await themedPreset(page).check();
        await expectColors(widget, THEMED_PRESET_COLORS[scheme]);
      });
    }

    test("leave color-scheme out of the Widget's style on System", async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await page.goto(host.path);
      const widget = controlledWidget(page);
      await themedPreset(page).check();
      await settingsRadio(page, "Color scheme", "Dark").check();
      await expect(widget).toHaveAttribute("style", /color-scheme: dark/);

      await settingsRadio(page, "Color scheme", "System").check();

      await expect(widget).not.toHaveAttribute("style", /color-scheme/);
      await expectColors(widget, THEMED_PRESET_COLORS.light);

      await settingsRadio(page, "Theme", "None").check();

      await expect(widget).toHaveAttribute("style", DEFAULT_WIDTH_STYLE);
    });

    test("switch the Widget to imperial units", async ({ page }) => {
      await page.goto(host.path);

      await widgetSettings(page)
        .getByRole("group", { name: "Units" })
        .getByRole("radio", { name: "Imperial" })
        .check();

      await expect(
        controlledWidget(page)
          .getByText(RECORDED_NIEUWEGEIN_TEMPERATURE_FAHRENHEIT, {
            exact: true,
          })
          .first(),
      ).toBeVisible();
    });

    test("can be reached and changed with the keyboard alone", async ({
      page,
    }) => {
      await page.goto(host.path);
      const english = widgetSettings(page).getByRole("radio", {
        name: "English",
      });
      await english.focus();

      await page.keyboard.press("ArrowDown");

      const dutch = widgetSettings(page).getByRole("radio", { name: "Dutch" });
      await expect(dutch).toBeChecked();
      await expect(dutch).toBeFocused();
      await expect(
        controlledWidget(page).getByText("Gevoelstemperatuur"),
      ).toBeVisible();

      await page.keyboard.press("Tab");

      const metric = widgetSettings(page).getByRole("radio", {
        name: "Metric",
      });
      await expect(metric).toBeFocused();
      await expect(metric).not.toHaveCSS("outline-style", "none");

      await page.keyboard.press("Tab");
      await page.keyboard.press("Space");

      const current = forecastParts(page).getByRole("checkbox", {
        name: "Current weather",
      });
      await expect(current).not.toBeChecked();
      await expect(current).toBeFocused();
      await expect(current).not.toHaveCSS("outline-style", "none");
      await expectParts(controlledWidget(page), "hourly daily");

      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("ArrowDown");

      await expect(themedPreset(page)).toBeChecked();
      await expect(themedPreset(page)).toBeFocused();
      await expect(themedPreset(page)).not.toHaveCSS("outline-style", "none");
      await expect(controlledWidget(page)).toHaveCSS(
        "font-family",
        "Georgia, serif",
      );

      await page.keyboard.press("Tab");
      await page.keyboard.press("ArrowDown");

      const light = settingsRadio(page, "Color scheme", "Light");
      await expect(light).toBeChecked();
      await expect(light).toBeFocused();
      await expect(light).not.toHaveCSS("outline-style", "none");
      await expect(controlledWidget(page)).toHaveAttribute(
        "style",
        /color-scheme: light/,
      );

      await page.keyboard.press("Tab");
      await page.keyboard.press("ArrowDown");

      const wide = widthRadio(page, 640);
      await expect(wide).toBeChecked();
      await expect(wide).toBeFocused();
      await expect(wide).not.toHaveCSS("outline-style", "none");
      await expect(controlledWidget(page)).toHaveAttribute(
        "style",
        /inline-size: 640px/,
      );
    });

    test("leave out the parts attribute while every Forecast part is ticked", async ({
      page,
    }) => {
      await page.goto(host.path);
      const widget = controlledWidget(page);
      const daily = forecastParts(page).getByRole("checkbox", {
        name: "Daily forecast",
      });
      await daily.uncheck();
      await expectParts(widget, "current hourly");

      await daily.check();

      await expectParts(widget, null);
      await expect(
        widget.getByRole("list", { name: DAILY_FORECAST_LIST }),
      ).toHaveCount(1);
    });

    test("keep the last Forecast part ticked and announce why", async ({
      page,
    }) => {
      await page.goto(host.path);
      const parts = forecastParts(page);
      await parts.getByRole("checkbox", { name: "Current weather" }).uncheck();
      await parts.getByRole("checkbox", { name: "Hourly forecast" }).uncheck();
      const daily = parts.getByRole("checkbox", { name: "Daily forecast" });
      await daily.focus();

      await page.keyboard.press("Space");

      await expect(daily).toBeChecked();
      await expect(daily).toBeFocused();
      await expectParts(controlledWidget(page), "daily");
      await expect(widgetSettings(page).getByRole("status")).toHaveText(
        FORECAST_PARTS_HINT,
      );
      await expect(parts).toHaveAccessibleDescription(FORECAST_PARTS_HINT);

      await parts.getByRole("checkbox", { name: "Hourly forecast" }).check();

      await expect(widgetSettings(page).getByRole("status")).toBeEmpty();
    });

    test(`render the Widget ${String(WIDEST_WIDTH)} pixels wide`, async ({
      page,
    }) => {
      await page.goto(host.path);
      const widget = controlledWidget(page);
      await expect(widget.getByRole("heading", { level: 2 })).toBeVisible();

      await widthRadio(page, WIDEST_WIDTH).check();

      await expect
        .poll(async () => (await widget.boundingBox())?.width)
        .toBe(WIDEST_WIDTH);
    });

    test(`cap ${String(WIDEST_WIDTH)} pixels at the available width on a phone`, async ({
      page,
    }) => {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.goto(host.path);
      const widget = controlledWidget(page);
      await expect(widget.getByRole("heading", { level: 2 })).toBeVisible();

      await widthRadio(page, WIDEST_WIDTH).check();

      await expect(widget).toHaveAttribute(
        "style",
        onlyWidthStyle(WIDEST_WIDTH),
      );
      const [widgetBox, pickerBox] = await Promise.all(
        [widget, page.locator("weather-location-picker")].map((part) =>
          part.boundingBox(),
        ),
      );
      expect(widgetBox?.width).toBeLessThan(WIDEST_WIDTH);
      expect(widgetBox?.width).toBe(pickerBox?.width);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(MOBILE_VIEWPORT.width);
    });

    test("keep their locale when the Location picker chooses a new Location", async ({
      page,
    }) => {
      await page.goto(host.path);
      const picker = page.locator("weather-location-picker");
      await widgetSettings(page).getByRole("radio", { name: "Dutch" }).check();

      await picker.getByRole("searchbox", { name: "Location" }).fill("Paris");
      await picker.getByRole("button", { name: "Search" }).click();
      await picker
        .getByRole("button", { name: "Paris Texas, United States" })
        .click();

      await expect(
        controlledWidget(page).getByRole("heading", {
          level: 2,
          name: "Paris",
        }),
      ).toBeVisible();
      await expect(
        controlledWidget(page).getByText("Gevoelstemperatuur"),
      ).toBeVisible();
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
