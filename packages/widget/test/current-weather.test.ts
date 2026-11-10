import { beforeEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  NIEUWEGEIN,
  forecastWith,
  shownMessage,
  locationName,
  respondWith,
  fakeProxy,
  renderWidget,
  weatherProviderCredit,
} from "./support.ts";

describe("<weather-widget>", () => {
  describe("Current weather", () => {
    beforeEach(() => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));
    });

    it("shows them without a chance of precipitation when the Proxy has none", async () => {
      fakeProxy.mockImplementation(() =>
        respondWith(forecastWith({ precipitationChance: null })),
      );

      renderWidget(NIEUWEGEIN);

      await expect.element(locationName()).toBeVisible();
      expect(page.getByText("Chance of precipitation").query()).toBeNull();
    });

    it("shows the feels-like temperature, wind and chance of precipitation", async () => {
      renderWidget(NIEUWEGEIN);

      await expect.element(locationName()).toBeVisible();
      expect(
        page.getByText("Feels like").element().closest("dt")
          ?.nextElementSibling,
      ).toHaveTextContent("7°");
      expect(
        page.getByText("Wind", { exact: true }).element().closest("dt")
          ?.nextElementSibling,
      ).toHaveTextContent("12 km/h SSW");
      expect(
        page.getByText("Chance of precipitation").element().closest("dt")
          ?.nextElementSibling,
      ).toHaveTextContent("85%");
    });

    it("shows when the Weather provider observed it, in Location time", async () => {
      renderWidget(NIEUWEGEIN);

      const updated = shownMessage("Updated at");
      await expect.element(updated).toHaveTextContent("Updated at 10:41 AM");
      expect(updated.element().querySelector("time")?.dateTime).toBe(
        "2026-11-08T09:41:44.000Z",
      );
    });

    it("credits OpenWeather with the whole credit as a visible link", async () => {
      renderWidget(NIEUWEGEIN);

      await expect
        .element(weatherProviderCredit())
        .toHaveAttribute("href", "https://openweathermap.org/");
      expect(shownMessage("Updated at").element()).toHaveTextContent(
        /^\s*Updated at 10:41 AM\s*·\s*Weather data provided by OpenWeather\s*$/,
      );
    });

    it("tells screen readers the temperatures, units and wind in full", async () => {
      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByText("9 degrees Celsius"))
        .toBeInTheDocument();
      expect(page.getByText("9°").element()).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      expect(page.getByText("7 degrees Celsius").query()).not.toBeNull();
      expect(
        page
          .getByText("12 kilometers per hour from the south-southwest")
          .query(),
      ).not.toBeNull();
      expect(page.getByText("12 km/h SSW").element()).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    });

    it.each([
      [0, "N", "north"],
      [11.24, "N", "north"],
      [11.25, "NNE", "north-northeast"],
      [90, "E", "east"],
      [198, "SSW", "south-southwest"],
      [348.75, "N", "north"],
      [360, "N", "north"],
    ])(
      "names wind from %d degrees %s",
      async (windDirectionDegrees, short, spoken) => {
        fakeProxy.mockImplementation(() =>
          respondWith(forecastWith({ windDirectionDegrees })),
        );

        renderWidget(NIEUWEGEIN);

        await expect
          .element(page.getByText(`12 km/h ${short}`, { exact: true }))
          .toBeInTheDocument();
        expect(
          page
            .getByText(`12 kilometers per hour from the ${spoken}`, {
              exact: true,
            })
            .query(),
        ).not.toBeNull();
      },
    );
  });

  describe("calm air", () => {
    it.each([
      ["no wind", 0],
      ["wind under half a kilometer per hour", 0.13],
    ])(
      "shows Calm without a direction for %s",
      async (_, windSpeedMetresPerSecond) => {
        fakeProxy.mockImplementation(() =>
          respondWith(forecastWith({ windSpeedMetresPerSecond })),
        );

        renderWidget(NIEUWEGEIN);

        await expect.element(locationName()).toBeVisible();
        expect(
          page.getByText("Wind", { exact: true }).element().closest("dt")
            ?.nextElementSibling,
        ).toHaveTextContent(/^\s*Calm\s*$/);
      },
    );

    it("shows speed and direction from half a kilometer per hour", async () => {
      fakeProxy.mockImplementation(() =>
        respondWith(forecastWith({ windSpeedMetresPerSecond: 0.14 })),
      );

      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByText("1 km/h SSW", { exact: true }))
        .toBeInTheDocument();
    });
  });
});
