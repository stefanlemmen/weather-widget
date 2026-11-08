import { describe, expect, it, vi } from "vitest";
import {
  NIEUWEGEIN,
  hoursFrom,
  forecastWith,
  fullForecast,
  forecastIn,
  respondWith,
  fakeProxy,
  renderWidget,
  hourlyForecast,
  textsOf,
  conditionsShownIn,
} from "./support.ts";

const shownHours = () => textsOf(hourlyForecast(), "time");

describe("the Hourly forecast", () => {
  it("shows twelve hours, each with its time, Condition, temperature and chance of precipitation", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    await expect.element(hourlyForecast()).toBeVisible();
    const hours = hourlyForecast().getByRole("listitem").elements();
    expect(hours).toHaveLength(12);
    expect(hours[0]).toHaveTextContent(/10 AM.*31°.*85%/);
    expect(hours[1]).toHaveTextContent(/11 AM.*32°.*0%/);
    expect(conditionsShownIn(hourlyForecast()).slice(0, 2)).toEqual([
      "Rain",
      "Overcast",
    ]);
    expect(hours[0]?.querySelector("time")?.dateTime).toBe(
      "2026-11-08T09:00:00.000Z",
    );
  });

  it("starts at the hour under way and leaves out hours that have ended", async () => {
    vi.setSystemTime("2026-11-08T11:05:00Z");
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    await expect.element(hourlyForecast()).toBeVisible();
    expect(shownHours().slice(0, 2)).toEqual(["12 PM", "1 PM"]);
    expect(shownHours()).toHaveLength(12);
  });

  it("shows every hour the Proxy returns when it returns fewer than twelve", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(
        forecastWith({}, {}, { hours: hoursFrom("2026-11-08T09:00:00Z", 3) }),
      ),
    );

    renderWidget(NIEUWEGEIN);

    await expect.element(hourlyForecast()).toBeVisible();
    expect(shownHours()).toEqual(["10 AM", "11 AM", "12 PM"]);
  });

  it("tells screen readers the temperature and chance of precipitation in full", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    const firstHour = hourlyForecast().getByRole("listitem").first();
    await expect
      .element(firstHour.getByText("31 degrees Celsius"))
      .toBeInTheDocument();
    expect(firstHour.getByText("31°").element()).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(firstHour.element()).toHaveTextContent(
      /Chance of precipitation\s*85%/,
    );
  });

  it.each([
    ["Pacific/Kiritimati", "2026-11-08T09:00:00Z", ["11 PM", "12 AM", "1 AM"]],
    ["Pacific/Pago_Pago", "2026-11-08T09:00:00Z", ["10 PM", "11 PM", "12 AM"]],
    ["Asia/Kolkata", "2026-11-08T09:00:00Z", ["2 PM", "3 PM", "4 PM"]],
  ])(
    "shows the hours of a Location in %s in its own time, across midnight",
    async (timeZone, now, hours) => {
      vi.setSystemTime(now);
      fakeProxy.mockImplementation(() =>
        respondWith(
          forecastIn(timeZone, { hours: hoursFrom("2026-11-08T09:00:00Z") }),
        ),
      );

      renderWidget(NIEUWEGEIN);

      await expect.element(hourlyForecast()).toBeVisible();
      expect(shownHours().slice(0, 3)).toEqual(hours);
    },
  );

  it.each([
    [
      "the clocks go back",
      "2026-10-25T00:00:00Z",
      ["2 AM", "2 AM", "3 AM", "4 AM"],
    ],
    [
      "the clocks go forward",
      "2027-03-28T00:00:00Z",
      ["1 AM", "3 AM", "4 AM", "5 AM"],
    ],
  ])(
    "follows the Location's clock when %s",
    async (_, firstHourStartsAt, hours) => {
      vi.setSystemTime(firstHourStartsAt);
      fakeProxy.mockImplementation(() =>
        respondWith(
          forecastWith({}, {}, { hours: hoursFrom(firstHourStartsAt) }),
        ),
      );

      renderWidget(NIEUWEGEIN);

      await expect.element(hourlyForecast()).toBeVisible();
      expect(shownHours().slice(0, 4)).toEqual(hours);
    },
  );
});
