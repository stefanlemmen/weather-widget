import { afterEach, describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";
import {
  NIEUWEGEIN,
  RECORDED_AT,
  dailyForecast,
  daysFrom,
  hoursFrom,
  fakeProxy,
  forecastWith,
  fullForecast,
  hourlyForecast,
  locationName,
  renderWidget,
  respondWith,
  unavailable,
} from "./support.ts";

const NARROW_SIDEBAR = "240px";
const COLUMN = "390px";
const WIDE_COLUMN = "600px";
const WIDEST = "760px";
const VERY_WIDE = "72rem";
const DAILY_LIST_MAX_REM = 40;

const CREAM_THEME = {
  "--weather-background": "#fffaf2",
  "--weather-ink": "#2b1d16",
  "--weather-accent": "#8a3b12",
  "--weather-radius": "20px",
  "--weather-font": "Georgia, serif",
} as const;

const computed = (property: "color" | "backgroundColor", cssColor: string) => {
  const probe = document.createElement("span");
  probe.style[property] = cssColor;
  document.body.append(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
};

const colorOf = (cssColor: string) => computed("color", cssColor);

const renderAt = async (
  inlineSize: string,
  forecast = fullForecast(),
  attributes: Readonly<Record<string, string>> = NIEUWEGEIN,
) => {
  fakeProxy.mockImplementation(() => respondWith(forecast));
  const widget = renderWidget(attributes);
  widget.style.inlineSize = inlineSize;
  await expect.element(locationName()).toBeVisible();
  return widget;
};

const inside = (widget: HTMLElement) => page.elementLocator(widget);

const hoursOf = (widget: HTMLElement) =>
  inside(widget)
    .getByRole("list", { name: "Next 12 hours" })
    .getByRole("listitem")
    .elements();

const daysOf = (widget: HTMLElement) =>
  inside(widget)
    .getByRole("list", { name: "Next 5 days" })
    .getByRole("listitem")
    .elements();

const rowCount = (elements: readonly Element[]) =>
  new Set(
    elements.map((element) => Math.round(element.getBoundingClientRect().top)),
  ).size;

const shownDayName = (day: Element) =>
  Array.from(
    day.firstElementChild?.querySelectorAll('[aria-hidden="true"]') ?? [],
  )
    .filter(
      (element) =>
        element.children.length === 0 &&
        element.checkVisibility() &&
        element.getBoundingClientRect().width > 1,
    )
    .map((element) => element.textContent.trim())
    .join("");

const factsOf = (widget: HTMLElement) =>
  Array.from(widget.shadowRoot?.querySelectorAll("dl > div") ?? []);

describe("theming", () => {
  it("takes its ground, ink, accent, radius and font from custom properties on its style attribute", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));
    const widget = renderWidget(NIEUWEGEIN);
    for (const [property, value] of Object.entries(CREAM_THEME)) {
      widget.style.setProperty(property, value);
    }

    const link = page.getByRole("link", { name: "OpenWeather" });
    await expect.element(link).toBeVisible();
    const styles = getComputedStyle(widget);
    expect(styles.backgroundColor).toBe(
      computed("backgroundColor", CREAM_THEME["--weather-background"]),
    );
    expect(styles.color).toBe(colorOf(CREAM_THEME["--weather-ink"]));
    expect(styles.borderRadius).toBe("20px");
    expect(styles.fontFamily).toBe("Georgia, serif");
    expect(getComputedStyle(link.element()).color).toBe(
      colorOf(CREAM_THEME["--weather-accent"]),
    );
  });

  it("takes them from a Host page stylesheet", async () => {
    const stylesheet = document.createElement("style");
    stylesheet.textContent = `weather-widget { --weather-accent: #8a3b12; }`;
    document.body.append(stylesheet);

    await renderAt(COLUMN);

    const link = page.getByRole("link", { name: "OpenWeather" });
    expect(getComputedStyle(link.element()).color).toBe(
      colorOf(CREAM_THEME["--weather-accent"]),
    );
  });

  it("mixes the Daily forecast band from the themed ink and ground, so a theme keeps the hierarchy", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));
    const widget = renderWidget(NIEUWEGEIN);
    widget.style.setProperty("--weather-background", "#fffaf2");
    widget.style.setProperty("--weather-ink", "#2b1d16");

    await expect.element(dailyForecast()).toBeVisible();
    const band = dailyForecast().element().closest("section");
    expect(band && getComputedStyle(band).backgroundColor).toBe(
      computed("backgroundColor", "color-mix(in oklab, #2b1d16 6%, #fffaf2)"),
    );
  });

  it("rounds its buttons at half the theme radius", async () => {
    fakeProxy.mockImplementation(() => respondWith(unavailable, 503));
    const widget = renderWidget(NIEUWEGEIN);
    widget.style.setProperty("--weather-radius", "20px");

    const button = page.getByRole("button", { name: "Try again" });
    await expect.element(button).toBeVisible();
    expect(getComputedStyle(button.element()).borderRadius).toBe("10px");
  });

  it("uses the design tokens when the Host page sets none", async () => {
    const widget = await renderAt(COLUMN);

    const styles = getComputedStyle(widget);
    expect(styles.borderRadius).toBe("12px");
    expect(styles.fontFamily).toBe("Lexend, system-ui, sans-serif");
  });
});

describe("type scale", () => {
  it("makes the current temperature the largest text, extra bold", async () => {
    await renderAt(WIDE_COLUMN);

    const temperature = page.getByText("9°", { exact: true }).element();
    const styles = getComputedStyle(temperature);
    expect(styles.fontSize).toBe("104px");
    expect(styles.fontWeight).toBe("800");
  });

  it("scales the current temperature down in a narrow sidebar", async () => {
    await renderAt(NARROW_SIDEBAR);

    const temperature = page.getByText("9°", { exact: true }).element();
    const fontSize = Number.parseFloat(getComputedStyle(temperature).fontSize);
    expect(fontSize).toBeGreaterThanOrEqual(56);
    expect(fontSize).toBeLessThan(104);
  });

  it("sets the Location's name as the headline", async () => {
    await renderAt(COLUMN);

    const styles = getComputedStyle(locationName().element());
    expect(styles.fontSize).toBe("28px");
    expect(styles.fontWeight).toBe("800");
  });

  it("uses tabular figures, so numbers line up", async () => {
    const widget = await renderAt(COLUMN);

    expect(getComputedStyle(widget).fontVariantNumeric).toBe("tabular-nums");
  });

  it.each([
    ["light", "#13243a", "#eef3f9"],
    ["dark", "#f2f5f9", "#16263b"],
  ] as const)(
    "paints a chance of precipitation in rain blue and a dry hour in muted ink in the %s scheme",
    async (colorScheme, ink, ground) => {
      await commands.emulateMedia({ colorScheme });
      await renderAt(COLUMN);

      const [wet, dry] = hourlyForecast()
        .getByRole("listitem")
        .elements()
        .map((hour) => hour.lastElementChild);
      expect(wet && getComputedStyle(wet).color).toBe(
        colorOf(`color-mix(in oklab, #3b82f0 65%, ${ink})`),
      );
      expect(wet && getComputedStyle(wet).fontWeight).toBe("600");
      expect(dry && getComputedStyle(dry).color).toBe(
        colorOf(`color-mix(in oklab, ${ink} 66%, ${ground})`),
      );
      expect(dry && getComputedStyle(dry).fontWeight).toBe("400");
    },
  );

  afterEach(async () => {
    await commands.emulateMedia({ colorScheme: "light" });
  });
});

describe("layout by the Widget's own width", () => {
  it.each([
    [NARROW_SIDEBAR, 3],
    [COLUMN, 2],
    [WIDE_COLUMN, 2],
    [WIDEST, 1],
  ])("shows twelve hours at %s wide in %d rows", async (width, rows) => {
    const widget = await renderAt(width);

    const hours = hoursOf(widget);
    expect(hours).toHaveLength(12);
    expect(rowCount(hours)).toBe(rows);
  });

  it.each([
    [NARROW_SIDEBAR, 4],
    [COLUMN, 6],
  ])(
    "draws a track line above each row of hours after the first at %s wide",
    async (width, perRow) => {
      const widget = await renderAt(width);

      const lines = hoursOf(widget).map(
        (hour) => getComputedStyle(hour).borderTopWidth,
      );
      expect(lines.slice(0, perRow).every((line) => line === "0px")).toBe(true);
      expect(lines.slice(perRow).every((line) => line === "1px")).toBe(true);
    },
  );

  it("draws no track lines when the hours fit one row", async () => {
    const widget = await renderAt(WIDEST);

    expect(
      hoursOf(widget).map((hour) => getComputedStyle(hour).borderTopWidth),
    ).toEqual(Array.from({ length: 12 }, () => "0px"));
  });

  it("follows its own width, not the viewport's, so two Widgets on one page can differ", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));
    const narrow = renderWidget(NIEUWEGEIN);
    const wide = renderWidget(NIEUWEGEIN);
    narrow.style.inlineSize = NARROW_SIDEBAR;
    wide.style.inlineSize = WIDEST;

    await expect
      .element(inside(wide).getByRole("heading", { level: 2 }))
      .toBeVisible();
    await expect
      .element(inside(narrow).getByRole("heading", { level: 2 }))
      .toBeVisible();
    expect(rowCount(hoursOf(narrow))).toBe(3);
    expect(rowCount(hoursOf(wide))).toBe(1);
  });

  it.each([NARROW_SIDEBAR, COLUMN, WIDE_COLUMN, WIDEST])(
    "keeps everything inside the Widget at %s wide",
    async (width) => {
      const widget = await renderAt(
        width,
        forecastWith(
          { temperatureCelsius: -12, windSpeedMetresPerSecond: 31 },
          {},
          { hours: hoursFrom(RECORDED_AT), days: daysFrom(RECORDED_AT) },
        ),
      );

      const bounds = widget.getBoundingClientRect();
      for (const element of widget.shadowRoot?.querySelectorAll("*") ?? []) {
        const { left, right } = element.getBoundingClientRect();
        if (right === 0 && left === 0) continue;
        expect(left).toBeGreaterThanOrEqual(Math.floor(bounds.left));
        expect(right).toBeLessThanOrEqual(Math.ceil(bounds.right));
      }
    },
  );

  describe("Current weather", () => {
    it("puts the facts in three columns under the temperature in a column", async () => {
      const widget = await renderAt(COLUMN);

      expect(rowCount(factsOf(widget))).toBe(1);
    });

    it("puts each fact on its own row in a narrow sidebar", async () => {
      const widget = await renderAt(NARROW_SIDEBAR);

      expect(rowCount(factsOf(widget))).toBe(3);
    });

    it("lists the facts to the right of the temperature in a wide column", async () => {
      const widget = await renderAt(WIDE_COLUMN);

      const temperature = page.getByText("9°", { exact: true }).element();
      const facts = factsOf(widget);
      expect(rowCount(facts)).toBe(3);
      for (const fact of facts) {
        expect(fact.getBoundingClientRect().left).toBeGreaterThan(
          temperature.getBoundingClientRect().right,
        );
      }
    });

    it("hyphenates long fact and Condition labels, but not the Location's name", async () => {
      const widget = await renderAt(COLUMN, fullForecast(), {
        ...NIEUWEGEIN,
        locale: "nl",
      });

      const hyphensOf = (element: Element | null | undefined) =>
        element ? getComputedStyle(element).hyphens : undefined;
      expect(hyphensOf(page.getByText("Gevoelstemperatuur").element())).toBe(
        "auto",
      );
      expect(hyphensOf(widget.shadowRoot?.querySelector(".condition"))).toBe(
        "auto",
      );
      expect(hyphensOf(locationName().element())).toBe("manual");
    });

    it("draws an icon beside each fact that screen readers skip", async () => {
      const widget = await renderAt(COLUMN);

      for (const fact of factsOf(widget)) {
        const icon = fact.querySelector("svg");
        expect(icon).not.toBeNull();
        expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
      }
    });

    it("points the wind compass's needle where the wind blows to", async () => {
      const widget = await renderAt(
        COLUMN,
        forecastWith({ windDirectionDegrees: 225 }),
      );

      const needle = widget.shadowRoot?.querySelector("[data-needle]");
      expect(needle?.getAttribute("transform")).toMatch(/^rotate\(360 64 64\)/);
    });
  });

  describe("Daily forecast", () => {
    const rangeOf = (day: Element) => {
      const track = day.querySelector("[data-range]");
      const fill = track?.firstElementChild;
      if (!track || !fill) return undefined;
      const trackBounds = track.getBoundingClientRect();
      const fillBounds = fill.getBoundingClientRect();
      return {
        shown: track.checkVisibility(),
        from: (fillBounds.left - trackBounds.left) / trackBounds.width,
        to: (fillBounds.right - trackBounds.left) / trackBounds.width,
      };
    };

    it("shows each day's low to high as a range bar on a scale shared by the five days", async () => {
      const widget = await renderAt(COLUMN);

      const lowest = 20.51;
      const highest = 54.29;
      const ranges = daysOf(widget).map(rangeOf);
      expect(ranges[0]?.shown).toBe(true);
      expect(ranges[0]?.from).toBeCloseTo(0, 2);
      expect(ranges[0]?.to).toBeCloseTo(
        (50.29 - lowest) / (highest - lowest),
        2,
      );
      expect(ranges[4]?.from).toBeCloseTo(
        (24.51 - lowest) / (highest - lowest),
        2,
      );
      expect(ranges[4]?.to).toBeCloseTo(1, 2);
    });

    it("keeps a day's values within 40rem of its name in a very wide Widget", async () => {
      const widget = await renderAt(VERY_WIDE);

      const remInPixels = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      const days = daysOf(widget);
      expect(days).toHaveLength(5);
      for (const day of days) {
        const { firstElementChild: name, lastElementChild: chance } = day;
        if (!name || !chance) throw new Error("A day has no columns");
        expect(
          chance.getBoundingClientRect().right -
            name.getBoundingClientRect().left,
        ).toBeLessThanOrEqual(DAILY_LIST_MAX_REM * remInPixels);
      }
    });

    it("hides the range bar from screen readers", async () => {
      const widget = await renderAt(COLUMN);

      const track = daysOf(widget)[0]?.querySelector("[data-range]");
      expect(track).toHaveAttribute("aria-hidden", "true");
    });

    it("drops the range bar below 24rem", async () => {
      const widget = await renderAt("23rem");

      expect(daysOf(widget).map((day) => rangeOf(day)?.shown)).toEqual(
        Array.from({ length: 5 }, () => false),
      );
    });

    it.each([NARROW_SIDEBAR, COLUMN, WIDE_COLUMN])(
      "lines up the highs of the five days at %s wide",
      async (width) => {
        const widget = await renderAt(width);

        const highs = daysOf(widget).map((day) => {
          const high = Array.from(day.children).find((child) =>
            child.textContent.includes("High"),
          );
          return high?.getBoundingClientRect().right;
        });
        expect(new Set(highs).size).toBe(1);
      },
    );

    it.each([
      [NARROW_SIDEBAR, "Su"],
      [COLUMN, "Sun"],
      [WIDE_COLUMN, "Sunday"],
    ])("names the day at %s wide as %s", async (width, name) => {
      const widget = await renderAt(width);

      const [firstDay] = daysOf(widget);
      expect(firstDay && shownDayName(firstDay)).toBe(name);
    });

    it("tells screen readers the full day name at every width", async () => {
      await renderAt(NARROW_SIDEBAR);

      const firstDay = dailyForecast().getByRole("listitem").first();
      const heard = firstDay.getByText("Sunday", { exact: true }).elements();
      expect(
        heard.filter(
          (element) => element.closest('[aria-hidden="true"]') === null,
        ),
      ).toHaveLength(1);
    });
  });
});
