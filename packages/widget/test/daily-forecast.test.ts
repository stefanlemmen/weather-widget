import { describe, expect, it, vi } from "vitest";
import {
  NIEUWEGEIN,
  daysFrom,
  forecastWith,
  fullForecast,
  forecastIn,
  respondWith,
  fakeProxy,
  renderWidget,
  dailyForecast,
  textsOf,
  conditionsShownIn,
} from "./support.ts";

const shownDays = () => textsOf(dailyForecast(), "abbr");

describe("the Daily forecast", () => {
  it("shows five days, each with its day name, Condition, low, high and chance of precipitation", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    await expect.element(dailyForecast()).toBeVisible();
    const days = dailyForecast().getByRole("listitem").elements();
    expect(days).toHaveLength(5);
    expect(days[0]).toHaveTextContent(/Sun.*Low.*21°C.*High.*50°C.*39%/);
    expect(conditionsShownIn(dailyForecast())[0]).toBe("Rain");
    expect(days[0]?.querySelector("abbr")?.title).toBe("Sunday");
    expect(shownDays()).toEqual(["Sun", "Mon", "Tue", "Wed", "Thu"]);
  });

  it("tells screen readers the low, high and chance of precipitation in full", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    const firstDay = dailyForecast().getByRole("listitem").first();
    await expect
      .element(firstDay.getByText("21 degrees Celsius"))
      .toBeInTheDocument();
    expect(firstDay.getByText("50 degrees Celsius").query()).not.toBeNull();
    expect(firstDay.element()).toHaveTextContent(
      /Chance of precipitation\s*39%/,
    );
  });

  it.each([
    ["one minute before midnight", "2026-11-08T22:59:00Z", "Sun"],
    ["at midnight", "2026-11-08T23:00:00Z", "Mon"],
  ])("starts on the Location's today, %s", async (_, now, firstDay) => {
    vi.setSystemTime(now);
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    await expect.element(dailyForecast()).toBeVisible();
    expect(shownDays()[0]).toBe(firstDay);
    expect(shownDays()).toHaveLength(5);
  });

  it.each([
    [
      "already in tomorrow",
      "Pacific/Kiritimati",
      ["Mon", "Tue", "Wed", "Thu", "Fri"],
    ],
    [
      "still in yesterday",
      "Pacific/Pago_Pago",
      ["Sun", "Mon", "Tue", "Wed", "Thu"],
    ],
  ])(
    "names the days of a Location %s by its own calendar (%s)",
    async (_, timeZone, days) => {
      vi.setSystemTime("2026-11-08T12:00:00Z");
      fakeProxy.mockImplementation(() =>
        respondWith(forecastIn(timeZone, { days: daysFrom("2026-11-08") })),
      );

      renderWidget(NIEUWEGEIN);

      await expect.element(dailyForecast()).toBeVisible();
      expect(shownDays()).toEqual(days);
    },
  );

  it("names each day once across a daylight saving change", async () => {
    vi.setSystemTime("2026-10-24T10:00:00Z");
    fakeProxy.mockImplementation(() =>
      respondWith(forecastWith({}, {}, { days: daysFrom("2026-10-24") })),
    );

    renderWidget(NIEUWEGEIN);

    await expect.element(dailyForecast()).toBeVisible();
    expect(shownDays()).toEqual(["Sat", "Sun", "Mon", "Tue", "Wed"]);
  });
});
