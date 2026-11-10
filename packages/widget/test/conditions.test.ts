import {
  CONDITIONS,
  DAY_OR_NIGHT_VALUES,
  type Condition,
  type Hour,
} from "@weather-widget/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commands, page } from "vitest/browser";
import {
  NIEUWEGEIN,
  daysFrom,
  forecastWith,
  fullForecast,
  locationName,
  respondWith,
  fakeProxy,
  renderWidget,
  hourlyForecast,
  dailyForecast,
} from "./support.ts";

describe("Conditions", () => {
  const METEOCONS_ICONS: Readonly<
    Record<Condition, readonly [day: string, night: string]>
  > = {
    clear: ["clear-day", "clear-night"],
    "partly-cloudy": ["partly-cloudy-day", "partly-cloudy-night"],
    "mostly-cloudy": ["overcast-day", "overcast-night"],
    overcast: ["cloudy", "cloudy"],
    fog: ["fog-day", "fog-night"],
    haze: ["haze-day", "haze-night"],
    drizzle: ["drizzle", "drizzle"],
    rain: ["rain", "rain"],
    sleet: ["sleet", "sleet"],
    snow: ["snow", "snow"],
    thunderstorm: ["thunderstorms-day", "thunderstorms-night"],
    unknown: ["not-available", "not-available"],
  };

  const ICON_ID_SEPARATOR = "__";
  const ANIMATION = "animate, animateTransform, animateMotion";

  const drawnIcon = (icon: Element) => ({
    name: icon.querySelector("g[id]")?.id.split(ICON_ID_SEPARATOR)[0],
    animated: icon.querySelector(ANIMATION) !== null,
  });

  const iconsIn = (list: ReturnType<typeof page.getByRole>) =>
    list.getByRole("img").elements().map(drawnIcon);

  const oneHour = (hour: Pick<Hour, "condition" | "dayOrNight">) =>
    forecastWith(
      {},
      {},
      {
        hours: [
          {
            startsAt: "2026-11-08T09:00:00.000Z",
            temperatureCelsius: 9,
            precipitationChance: 0,
            ...hour,
          },
        ],
      },
    );

  beforeEach(async () => {
    await commands.emulateMedia({ reducedMotion: "no-preference" });
  });

  afterEach(async () => {
    await commands.emulateMedia({ reducedMotion: "no-preference" });
  });

  it.each(
    CONDITIONS.flatMap((condition) =>
      DAY_OR_NIGHT_VALUES.map(
        (dayOrNight, index) =>
          [condition, dayOrNight, METEOCONS_ICONS[condition][index]] as const,
      ),
    ),
  )(
    "draws %s by %s as the Meteocons icon %s",
    async (condition, dayOrNight, icon) => {
      fakeProxy.mockImplementation(() =>
        respondWith(oneHour({ condition, dayOrNight })),
      );

      renderWidget({ ...NIEUWEGEIN, parts: "hourly" });

      await expect.element(hourlyForecast()).toBeVisible();
      expect(iconsIn(hourlyForecast())[0]?.name).toBe(icon);
    },
  );

  it("keeps every id in the Widget unique, so each icon's masks and clip paths point at its own shapes", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    const widget = renderWidget(NIEUWEGEIN);

    await expect.element(dailyForecast()).toBeVisible();
    const ids = Array.from(
      widget.shadowRoot?.querySelectorAll("[id]") ?? [],
      (element) => element.id,
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const reference of widget.shadowRoot?.querySelectorAll(
      "[clip-path], [mask]",
    ) ?? []) {
      const icon = reference.closest("svg");
      const target = (
        reference.getAttribute("clip-path") ?? reference.getAttribute("mask")
      )?.match(/url\(#(.+)\)/)?.[1];
      expect(target && icon?.querySelector(`[id="${target}"]`)).toBeTruthy();
    }
  });

  it("names the Condition of each hour and day by its icon alone", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    await expect
      .element(hourlyForecast().getByRole("img", { name: "Rain" }).first())
      .toBeVisible();
    await expect
      .element(dailyForecast().getByRole("img", { name: "Rain" }).first())
      .toBeVisible();
    expect(hourlyForecast().getByText("Rain").query()).toBeNull();
    expect(dailyForecast().getByText("Rain").query()).toBeNull();
  });

  it("draws every day with its day icon", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(
        forecastWith({}, {}, { days: daysFrom("2026-11-08").slice(2, 3) }),
      ),
    );
    vi.setSystemTime("2026-11-08T21:00:00Z");

    renderWidget({ ...NIEUWEGEIN, parts: "daily" });

    await expect.element(dailyForecast()).toBeVisible();
    expect(iconsIn(dailyForecast())[0]?.name).toBe("partly-cloudy-day");
  });

  it("labels the Condition of Current weather in text, beside an icon screen readers skip", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(
        forecastWith({ condition: "partly-cloudy", dayOrNight: "night" }),
      ),
    );

    renderWidget({ ...NIEUWEGEIN, parts: "current" });

    await expect.element(locationName()).toBeVisible();
    await expect.element(page.getByText("Partly cloudy")).toBeVisible();
    const icon = page
      .getByText("Partly cloudy")
      .element()
      .closest("p")
      ?.querySelector("svg");
    expect(icon && drawnIcon(icon).name).toBe("partly-cloudy-night");
    expect(icon?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(page.getByRole("img").query()).toBeNull();
  });

  it("animates the icons when the visitor has no motion preference", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    await expect.element(hourlyForecast()).toBeVisible();
    expect(iconsIn(hourlyForecast()).map((icon) => icon.animated)).toEqual(
      Array.from({ length: 12 }, () => true),
    );
  });

  it("draws still icons when the visitor prefers reduced motion", async () => {
    await commands.emulateMedia({ reducedMotion: "reduce" });
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    const widget = renderWidget(NIEUWEGEIN);

    await expect.element(hourlyForecast()).toBeVisible();
    expect(widget.shadowRoot?.querySelector(ANIMATION)).toBeNull();
    expect(iconsIn(hourlyForecast())[0]?.name).toBe("rain");
  });

  it("stops the icons when the visitor turns on reduced motion while the Forecast shows", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));
    const widget = renderWidget(NIEUWEGEIN);
    await expect.element(hourlyForecast()).toBeVisible();

    await commands.emulateMedia({ reducedMotion: "reduce" });

    await expect
      .poll(() => widget.shadowRoot?.querySelector(ANIMATION) ?? null)
      .toBeNull();
  });

  const bonesBehind = (placeholder: Element | null) => {
    const boneColor =
      placeholder && getComputedStyle(placeholder).backgroundColor;
    const bones: Element[] = [];
    for (
      let ancestor = placeholder?.parentElement;
      ancestor && !ancestor.classList.contains("skeleton");
      ancestor = ancestor.parentElement
    ) {
      if (getComputedStyle(ancestor).backgroundColor === boneColor) {
        bones.push(ancestor);
      }
    }
    return bones;
  };

  it("draws a circle in place of each icon while loading", async () => {
    fakeProxy.mockImplementation(() => new Promise(() => undefined));

    const widget = renderWidget(NIEUWEGEIN);
    await widget.updateComplete;

    const icons = widget.shadowRoot?.querySelectorAll("svg") ?? [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      const placeholder = icon.parentElement;
      expect(icon).not.toBeVisible();
      expect(placeholder && getComputedStyle(placeholder).borderRadius).toBe(
        "50%",
      );
      expect(bonesBehind(placeholder)).toEqual([]);
    }
  });
});

describe("icon sizes", () => {
  const sizeOf = (element: Element | undefined) => {
    const { width, height } = element?.getBoundingClientRect() ?? {
      width: 0,
      height: 0,
    };
    return [width, height];
  };

  const firstIconIn = (list: ReturnType<typeof page.getByRole>) =>
    list.getByRole("img").elements()[0];

  it.each([
    ["30rem", 40, 36],
    ["23rem", 40, 32],
  ])(
    "draws hour icons at %s wide at %dpx and day icons at %dpx",
    async (width, hourSize, daySize) => {
      fakeProxy.mockImplementation(() => respondWith(fullForecast()));

      const widget = renderWidget(NIEUWEGEIN);
      widget.style.inlineSize = width;

      await expect.element(dailyForecast()).toBeVisible();
      expect(sizeOf(firstIconIn(hourlyForecast()))).toEqual([
        hourSize,
        hourSize,
      ]);
      expect(sizeOf(firstIconIn(dailyForecast()))).toEqual([daySize, daySize]);
    },
  );
});
