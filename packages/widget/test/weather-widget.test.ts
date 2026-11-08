import type {
  CurrentConditions,
  ForecastResponse,
  Location,
  ProblemDetails,
} from "@weather-widget/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import "../src/index.ts";

const NIEUWEGEIN = { latitude: "52.03", longitude: "5.08" };

const RECORDED_CONDITIONS: CurrentConditions = {
  temperatureCelsius: 8.85,
  feelsLikeCelsius: 6.93,
  windSpeedMetresPerSecond: 3.35,
  windDirectionDegrees: 198,
  precipitationChance: 0.85,
  observedAt: "2026-11-08T09:41:44.000Z",
};

const NIEUWEGEIN_LOCATION: Location = {
  name: "Nieuwegein",
  timeZone: "Europe/Amsterdam",
};

const forecastWith = (
  conditions: Partial<CurrentConditions> = {},
  location: Partial<Location> = {},
): ForecastResponse => ({
  location: { ...NIEUWEGEIN_LOCATION, ...location },
  parts: {
    current: {
      status: "ok",
      data: { ...RECORDED_CONDITIONS, ...conditions },
    },
  },
});

const forecastWithTemperature = (temperatureCelsius: number) =>
  forecastWith({ temperatureCelsius });

const unavailable: ProblemDetails = {
  type: "about:blank",
  title: "Forecast unavailable",
  status: 503,
};

const respondWith = (body: unknown, status = 200) =>
  Promise.resolve(Response.json(body, { status }));

const fakeProxy = vi.fn<typeof fetch>();

const urlOf = (input: RequestInfo | URL) =>
  new URL(input instanceof Request ? input.url : input, document.baseURI);

const requestedUrls = () => fakeProxy.mock.calls.map(([input]) => urlOf(input));

const renderWidget = (attributes: Readonly<Record<string, string>>) => {
  const widget = document.createElement("weather-widget");
  for (const [name, value] of Object.entries(attributes)) {
    widget.setAttribute(name, value);
  }
  document.body.append(widget);
  return widget;
};

beforeEach(() => {
  fakeProxy.mockReset();
  vi.stubGlobal("fetch", fakeProxy);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("<weather-widget>", () => {
  it("shows the current temperature for the Location its Host page sets", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastWithTemperature(5.09)),
    );

    renderWidget(NIEUWEGEIN);

    await expect.element(page.getByText("5°C")).toBeVisible();
    const [url] = requestedUrls();
    expect(url?.pathname).toBe("/api/forecast");
    expect(url?.searchParams.get("latitude")).toBe("52.03");
    expect(url?.searchParams.get("longitude")).toBe("5.08");
  });

  it("asks the Proxy at the address set in proxy-url", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWithTemperature(5)));

    renderWidget({ ...NIEUWEGEIN, "proxy-url": "https://proxy.example/api" });

    await expect.element(page.getByText("5°C")).toBeVisible();
    expect(requestedUrls()[0]?.href).toBe(
      "https://proxy.example/api/forecast?latitude=52.03&longitude=5.08",
    );
  });

  it.each([
    [12.5, "13°C"],
    [-3.4, "-3°C"],
    [-0.4, "0°C"],
  ])("rounds %d °C to %s", async (temperature, shown) => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastWithTemperature(temperature)),
    );

    renderWidget(NIEUWEGEIN);

    await expect.element(page.getByText(shown, { exact: true })).toBeVisible();
  });

  it("announces that the Forecast is loading while the Proxy answers", async () => {
    fakeProxy.mockImplementation(() => new Promise(() => undefined));

    renderWidget(NIEUWEGEIN);

    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Loading forecast");
  });

  it.each([
    [
      "the network fails",
      () => Promise.reject(new TypeError("Failed to fetch")),
    ],
    [
      "the Proxy answers with Problem Details",
      () => respondWith(unavailable, 503),
    ],
    ["the response doesn't parse", () => respondWith({ temperature: 5 })],
    ["the response isn't JSON", () => Promise.resolve(new Response("<html>"))],
    [
      "Current conditions failed",
      () => respondWith({ parts: { current: { status: "error" } } }),
    ],
  ])('shows "Forecast unavailable" when %s', async (_, respond) => {
    fakeProxy.mockImplementation(respond);

    renderWidget(NIEUWEGEIN);

    await expect.element(page.getByText("Forecast unavailable")).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Try again" }))
      .toBeVisible();
  });

  it('fetches again when the visitor presses "Try again"', async () => {
    fakeProxy
      .mockImplementationOnce(() => respondWith(unavailable, 503))
      .mockImplementationOnce(() => respondWith(forecastWithTemperature(11)));
    renderWidget(NIEUWEGEIN);

    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByText("11°C")).toBeVisible();
    expect(fakeProxy).toHaveBeenCalledTimes(2);
  });

  it("shows the Forecast for the new Location when the Host page changes it", async () => {
    fakeProxy.mockImplementation((input) =>
      respondWith(
        forecastWithTemperature(
          urlOf(input).searchParams.get("latitude") === "35.68" ? 18 : 5,
        ),
      ),
    );
    const widget = renderWidget(NIEUWEGEIN);
    await expect.element(page.getByText("5°C")).toBeVisible();

    widget.setAttribute("latitude", "35.68");
    widget.setAttribute("longitude", "139.69");

    await expect.element(page.getByText("18°C")).toBeVisible();
  });

  it("ignores an earlier Location's answer that arrives after the new one", async () => {
    let answerNieuwegein: (response: Response) => void = () => undefined;
    fakeProxy
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answerNieuwegein = resolve;
          }),
      )
      .mockImplementation(() => respondWith(forecastWithTemperature(18)));
    const widget = renderWidget(NIEUWEGEIN);
    await vi.waitFor(() => {
      expect(fakeProxy).toHaveBeenCalledOnce();
    });

    widget.setAttribute("latitude", "35.68");
    await expect.element(page.getByText("18°C")).toBeVisible();
    const lateAnswer = Response.json(forecastWithTemperature(5));
    answerNieuwegein(lateAnswer);
    await vi.waitFor(() => {
      expect(lateAnswer.bodyUsed).toBe(true);
    });
    await new Promise((settle) => setTimeout(settle));
    await widget.updateComplete;

    expect(page.getByText("18°C").query()).not.toBeNull();
    expect(page.getByText("5°C").query()).toBeNull();
  });

  it("matches every attribute with a property", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWithTemperature(5)));
    const widget = document.createElement("weather-widget");

    widget.latitude = 52.03;
    widget.longitude = 5.08;
    widget.proxyUrl = "https://proxy.example/api";
    widget.locationName = "Home";
    document.body.append(widget);

    await expect.element(page.getByText("5°C")).toBeVisible();
    await expect
      .element(page.getByRole("heading", { level: 2 }))
      .toHaveTextContent("Home");
    expect(requestedUrls()[0]?.href).toBe(
      "https://proxy.example/api/forecast?latitude=52.03&longitude=5.08",
    );
  });

  it.each([
    ["longitude is missing", { latitude: "52.03" }],
    ["latitude is missing", { longitude: "5.08" }],
    ["latitude is not a number", { latitude: "north", longitude: "5.08" }],
    ["latitude is above 90", { latitude: "90.01", longitude: "5.08" }],
    ["latitude is below -90", { latitude: "-90.01", longitude: "5.08" }],
    ["longitude is above 180", { latitude: "52.03", longitude: "180.01" }],
    ["longitude is below -180", { latitude: "52.03", longitude: "-180.01" }],
  ])(
    'shows "Forecast unavailable" without "Try again" and asks nothing of the Proxy when %s',
    async (_, attributes) => {
      const widget = renderWidget(attributes);
      await widget.updateComplete;

      await expect
        .element(page.getByRole("status"))
        .toHaveTextContent("Forecast unavailable");
      expect(
        page.getByRole("button", { name: "Try again" }).query(),
      ).toBeNull();
      expect(fakeProxy).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["-90", "180"],
    ["90", "-180"],
  ])(
    "asks the Proxy for a Location at the edge of the map (%s, %s)",
    async (latitude, longitude) => {
      fakeProxy.mockImplementation(() =>
        respondWith(forecastWithTemperature(-30)),
      );

      renderWidget({ latitude, longitude });

      await expect.element(page.getByText("-30°C")).toBeVisible();
    },
  );

  it("shows the Forecast once the Host page completes the Location", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWithTemperature(5)));
    const widget = renderWidget({ latitude: "52.03" });
    await widget.updateComplete;

    widget.setAttribute("longitude", "5.08");

    await expect.element(page.getByText("5°C")).toBeVisible();
  });

  it("announces the Forecast through the live region that announced loading", async () => {
    let answer: (response: Response) => void = () => undefined;
    fakeProxy.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    renderWidget(NIEUWEGEIN);
    const liveRegion = page.getByRole("status");
    await expect.element(liveRegion).toHaveTextContent("Loading forecast");
    const regionWhileLoading = liveRegion.element();

    answer(Response.json(forecastWithTemperature(5)));

    await expect.element(liveRegion).toHaveTextContent("5°C");
    expect(liveRegion.element()).toBe(regionWhileLoading);
  });

  it('announces a failure through the live region that announced loading, with "Try again" outside it', async () => {
    let answer: (response: Response) => void = () => undefined;
    fakeProxy.mockImplementation(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
    );
    renderWidget(NIEUWEGEIN);
    const liveRegion = page.getByRole("status");
    await expect.element(liveRegion).toHaveTextContent("Loading forecast");
    const regionWhileLoading = liveRegion.element();

    answer(Response.json(unavailable, { status: 503 }));

    await expect.element(liveRegion).toHaveTextContent("Forecast unavailable");
    expect(liveRegion.element()).toBe(regionWhileLoading);
    await expect
      .element(page.getByRole("button", { name: "Try again" }))
      .toBeVisible();
    expect(liveRegion.element().querySelector("button")).toBeNull();
  });

  describe("Current conditions", () => {
    beforeEach(() => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));
    });

    it("shows the feels-like temperature, wind and chance of precipitation", async () => {
      renderWidget(NIEUWEGEIN);

      await expect.element(page.getByText("Feels like")).toBeVisible();
      expect(
        page.getByText("Feels like").element().nextElementSibling,
      ).toHaveTextContent("7°C");
      expect(
        page.getByText("Wind", { exact: true }).element().nextElementSibling,
      ).toHaveTextContent("12 km/h SSW");
      expect(
        page.getByText("Chance of precipitation").element().nextElementSibling,
      ).toHaveTextContent("85%");
    });

    it("shows when the Weather provider observed them, in the Location's local time", async () => {
      renderWidget(NIEUWEGEIN);

      const updated = page.getByText("Updated at");
      await expect.element(updated).toHaveTextContent("Updated at 10:41 AM");
      expect(updated.element().querySelector("time")?.dateTime).toBe(
        "2026-11-08T09:41:44.000Z",
      );
    });

    it("credits OpenWeather with a visible link", async () => {
      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByRole("link", { name: "OpenWeather" }))
        .toHaveAttribute("href", "https://openweathermap.org/");
    });

    it("tells screen readers the temperatures, units and wind in full", async () => {
      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByText("9 degrees Celsius"))
        .toBeInTheDocument();
      expect(page.getByText("9°C").element()).toHaveAttribute(
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

        await expect
          .element(page.getByText("Wind", { exact: true }))
          .toBeVisible();
        expect(
          page.getByText("Wind", { exact: true }).element().nextElementSibling,
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

  describe("the Location's name", () => {
    it("names the Location with the name the Proxy found", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));

      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByRole("heading", { level: 2 }))
        .toHaveTextContent("Nieuwegein");
    });

    it("prefers the name the Host page sets in location-name", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));

      renderWidget({ ...NIEUWEGEIN, "location-name": "Home" });

      await expect
        .element(page.getByRole("heading", { level: 2 }))
        .toHaveTextContent("Home");
    });

    it("ignores a blank location-name", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));

      renderWidget({ ...NIEUWEGEIN, "location-name": "   " });

      await expect
        .element(page.getByRole("heading", { level: 2 }))
        .toHaveTextContent("Nieuwegein");
    });

    it("updates the name when the Host page changes location-name", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));
      const widget = renderWidget({ ...NIEUWEGEIN, "location-name": "Home" });
      await expect
        .element(page.getByRole("heading", { level: 2 }))
        .toHaveTextContent("Home");

      widget.removeAttribute("location-name");

      await expect
        .element(page.getByRole("heading", { level: 2 }))
        .toHaveTextContent("Nieuwegein");
      expect(fakeProxy).toHaveBeenCalledOnce();
    });

    it.each([
      [
        { latitude: "52.03", longitude: "5.08" },
        "52.03° N, 5.08° E",
        "52.03 degrees north, 5.08 degrees east",
      ],
      [
        { latitude: "-33.87", longitude: "-70.6" },
        "33.87° S, 70.60° W",
        "33.87 degrees south, 70.60 degrees west",
      ],
      [
        { latitude: "0", longitude: "0" },
        "0.00° N, 0.00° E",
        "0.00 degrees north, 0.00 degrees east",
      ],
    ])(
      "names the Location by its coordinates when the Proxy found no name (%o)",
      async (coordinates, shown, heard) => {
        fakeProxy.mockImplementation(() =>
          respondWith(forecastWith({}, { name: null })),
        );

        renderWidget(coordinates);

        await expect
          .element(page.getByRole("heading", { level: 2 }))
          .toHaveTextContent(shown);
        expect(
          page.getByText(shown, { exact: true }).element(),
        ).toHaveAttribute("aria-hidden", "true");
        expect(page.getByText(heard, { exact: true }).query()).not.toBeNull();
      },
    );

    it("announces the Location's name with its temperature", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));

      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByRole("status"))
        .toHaveTextContent(/Nieuwegein.*9 degrees Celsius/);
      expect(page.getByRole("status").element()).not.toHaveTextContent(
        "Feels like",
      );
    });
  });
});
