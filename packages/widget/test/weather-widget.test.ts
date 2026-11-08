import type {
  Condition,
  CurrentConditions,
  Day,
  ForecastPart,
  ForecastResponse,
  Hour,
  Location,
  ProblemDetails,
} from "@weather-widget/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
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

const RECORDED_AT = "2026-11-08T09:41:44.000Z";
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;
const CONDITION_CYCLE: readonly Condition[] = [
  "rain",
  "overcast",
  "partly-cloudy",
  "clear",
];

const hoursFrom = (firstHourStartsAt: string, count = 20): Hour[] =>
  Array.from({ length: count }, (_, index) => ({
    startsAt: new Date(
      Date.parse(firstHourStartsAt) + index * MILLISECONDS_PER_HOUR,
    ).toISOString(),
    condition: CONDITION_CYCLE[index % CONDITION_CYCLE.length] ?? "unknown",
    temperatureCelsius: 30.75 + index,
    precipitationChance: index === 0 ? 0.85 : 0,
  }));

const daysFrom = (firstDate: string, count = 10): Day[] =>
  Array.from({ length: count }, (_, index) => ({
    date: new Date(Date.parse(firstDate) + index * MILLISECONDS_PER_DAY)
      .toISOString()
      .slice(0, "YYYY-MM-DD".length),
    condition: CONDITION_CYCLE[index % CONDITION_CYCLE.length] ?? "unknown",
    lowCelsius: 20.51 + index,
    highCelsius: 50.29 + index,
    precipitationChance: index === 0 ? 0.39 : 0,
  }));

const RECORDED_HOURS = hoursFrom("2026-11-08T09:00:00.000Z");
const RECORDED_DAYS = daysFrom("2026-11-08");

const forecastWith = (
  conditions: Partial<CurrentConditions> = {},
  location: Partial<Location> = {},
  { hours = [], days = [] }: { hours?: Hour[]; days?: Day[] } = {},
): ForecastResponse => ({
  location: { ...NIEUWEGEIN_LOCATION, ...location },
  parts: {
    current: {
      status: "ok",
      data: { ...RECORDED_CONDITIONS, ...conditions },
    },
    hourly: { status: "ok", data: hours },
    daily: { status: "ok", data: days },
  },
});

const fullForecast = () =>
  forecastWith({}, {}, { hours: RECORDED_HOURS, days: RECORDED_DAYS });

const forecastIn = (
  timeZone: string,
  forecast: { hours?: Hour[]; days?: Day[] },
) => forecastWith({}, { timeZone }, forecast);

const forecastWithTemperature = (temperatureCelsius: number) =>
  forecastWith({ temperatureCelsius });

const unavailable: ProblemDetails = {
  type: "about:blank",
  title: "Forecast unavailable",
  status: 503,
};

const FAILED_PART = { status: "error" } as const;

const forecastFailing = (...failed: readonly ForecastPart[]) => {
  const forecast = fullForecast();
  return {
    ...forecast,
    parts: {
      ...forecast.parts,
      ...Object.fromEntries(failed.map((part) => [part, FAILED_PART])),
    },
  };
};

const shownMessage = (text: string) =>
  page.getByRole("paragraph").filter({ hasText: text });

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

const ALL_PARTS = "current,hourly,daily";

beforeEach(() => {
  fakeProxy.mockReset();
  vi.stubGlobal("fetch", fakeProxy);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(RECORDED_AT);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
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
    expect(url?.searchParams.get("parts")).toBe(ALL_PARTS);
  });

  it("asks the Proxy at the address set in proxy-url", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWithTemperature(5)));

    renderWidget({ ...NIEUWEGEIN, "proxy-url": "https://proxy.example/api" });

    await expect.element(page.getByText("5°C")).toBeVisible();
    expect(requestedUrls()[0]?.href).toBe(
      `https://proxy.example/api/forecast?latitude=52.03&longitude=5.08&parts=${encodeURIComponent(ALL_PARTS)}`,
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
      "every Forecast part failed",
      () => respondWith(forecastFailing("current", "hourly", "daily")),
    ],
  ])('shows "Forecast unavailable" when %s', async (_, respond) => {
    fakeProxy.mockImplementation(respond);

    renderWidget(NIEUWEGEIN);

    await expect.element(shownMessage("Forecast unavailable")).toBeVisible();
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

  describe("focus after Try again", () => {
    const focusedIn = (widget: HTMLElement) =>
      widget.shadowRoot?.activeElement ?? null;

    const answerLater = () => {
      let answer: (response: Response) => void = () => undefined;
      fakeProxy.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            answer = resolve;
          }),
      );
      return (response: Response) => {
        answer(response);
      };
    };

    const pressTryAgain = async (widget: HTMLElement) => {
      const tryAgain = page.getByRole("button", { name: "Try again" });
      await tryAgain.click();
      expect(focusedIn(widget)).toBe(tryAgain.element());
      return tryAgain.element();
    };

    it("stays on Try again while the Widget fetches again and when it fails again", async () => {
      fakeProxy.mockImplementationOnce(() => respondWith(unavailable, 503));
      const widget = renderWidget(NIEUWEGEIN);
      const answer = answerLater();
      const tryAgain = await pressTryAgain(widget);

      await expect
        .element(page.getByRole("status"))
        .toHaveTextContent("Loading forecast");
      expect(focusedIn(widget)).toBe(tryAgain);

      answer(Response.json(unavailable, { status: 503 }));

      await expect
        .element(page.getByRole("status"))
        .toHaveTextContent("Forecast unavailable");
      expect(focusedIn(widget)).toBe(tryAgain);
    });

    it("moves to the Location's name when the Forecast arrives", async () => {
      fakeProxy.mockImplementationOnce(() => respondWith(unavailable, 503));
      const widget = renderWidget(NIEUWEGEIN);
      const answer = answerLater();
      await pressTryAgain(widget);

      answer(Response.json(fullForecast()));

      const name = page.getByRole("heading", { level: 2 });
      await expect.element(name).toBeVisible();
      await vi.waitFor(() => {
        expect(focusedIn(widget)).toBe(name.element());
      });
    });

    it("stays where the visitor moved it while the Widget fetched", async () => {
      fakeProxy.mockImplementationOnce(() => respondWith(unavailable, 503));
      const widget = renderWidget(NIEUWEGEIN);
      const answer = answerLater();
      await pressTryAgain(widget);
      const elsewhere = document.createElement("input");
      document.body.append(elsewhere);
      elsewhere.focus();

      answer(Response.json(fullForecast()));

      await expect
        .element(page.getByRole("heading", { level: 2 }))
        .toBeVisible();
      await widget.updateComplete;
      expect(document.activeElement).toBe(elsewhere);
    });

    it("fetches only once when the visitor presses Try again while it fetches", async () => {
      fakeProxy.mockImplementationOnce(() => respondWith(unavailable, 503));
      renderWidget(NIEUWEGEIN);
      answerLater();
      await page.getByRole("button", { name: "Try again" }).click();
      await expect
        .element(page.getByRole("status"))
        .toHaveTextContent("Loading forecast");

      await userEvent.keyboard("{Enter}");

      expect(fakeProxy).toHaveBeenCalledTimes(2);
    });
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
    widget.parts = "current hourly daily";
    document.body.append(widget);

    await expect.element(page.getByText("5°C")).toBeVisible();
    await expect
      .element(page.getByRole("heading", { level: 2 }))
      .toHaveTextContent("Home");
    expect(requestedUrls()[0]?.href).toBe(
      `https://proxy.example/api/forecast?latitude=52.03&longitude=5.08&parts=${encodeURIComponent(ALL_PARTS)}`,
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

    await expect.element(liveRegion).toHaveTextContent("Forecast for");
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

    it("shows them without a chance of precipitation when the Proxy has none", async () => {
      fakeProxy.mockImplementation(() =>
        respondWith(forecastWith({ precipitationChance: null })),
      );

      renderWidget(NIEUWEGEIN);

      await expect.element(page.getByText("Feels like")).toBeVisible();
      expect(page.getByText("Chance of precipitation").query()).toBeNull();
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

      const updated = shownMessage("Updated at");
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

    it("announces the Forecast for the Location and when it was updated", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));

      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByRole("status"))
        .toHaveTextContent("Forecast for Nieuwegein, updated at 10:41 AM");
    });

    it("announces the Forecast for the Location's coordinates in full when the Proxy found no name", async () => {
      fakeProxy.mockImplementation(() =>
        respondWith(forecastWith({}, { name: null })),
      );

      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByRole("status"))
        .toHaveTextContent(
          "Forecast for 52.03 degrees north, 5.08 degrees east, updated at 10:41 AM",
        );
    });
  });
});

const hourlyForecast = () => page.getByRole("list", { name: "Next 12 hours" });
const dailyForecast = () => page.getByRole("list", { name: "Next 5 days" });

const textsOf = (list: ReturnType<typeof page.getByRole>, selector: string) =>
  Array.from(list.element().querySelectorAll(selector), (element) =>
    element.textContent.trim(),
  );

const shownHours = () => textsOf(hourlyForecast(), "time");
const shownDays = () => textsOf(dailyForecast(), "abbr");

describe("the Hourly forecast", () => {
  it("shows twelve hours, each with its time, Condition, temperature and chance of precipitation", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    await expect.element(hourlyForecast()).toBeVisible();
    const hours = hourlyForecast().getByRole("listitem").elements();
    expect(hours).toHaveLength(12);
    expect(hours[0]).toHaveTextContent(/10 AM.*Rain.*31°C.*85%/);
    expect(hours[1]).toHaveTextContent(/11 AM.*Overcast.*32°C.*0%/);
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
    expect(firstHour.getByText("31°C").element()).toHaveAttribute(
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

describe("the Daily forecast", () => {
  it("shows five days, each with its day name, Condition, low, high and chance of precipitation", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget(NIEUWEGEIN);

    await expect.element(dailyForecast()).toBeVisible();
    const days = dailyForecast().getByRole("listitem").elements();
    expect(days).toHaveLength(5);
    expect(days[0]).toHaveTextContent(/Sun.*Rain.*Low.*21°C.*High.*50°C.*39%/);
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

describe("Forecast parts", () => {
  const SHOWN_FOR_PARTS = [
    ["current", "current"],
    ["hourly", "hourly"],
    ["daily", "daily"],
    ["current hourly", "current,hourly"],
    ["current daily", "current,daily"],
    ["hourly daily", "hourly,daily"],
    ["current hourly daily", "current,hourly,daily"],
  ] as const;

  const shownParts = () =>
    [
      page.getByText("Feels like").query() && "current",
      hourlyForecast().query() && "hourly",
      dailyForecast().query() && "daily",
    ]
      .filter(Boolean)
      .join(",");

  it.each(SHOWN_FOR_PARTS)(
    'shows and asks the Proxy for exactly the Forecast parts in parts="%s"',
    async (parts, requested) => {
      fakeProxy.mockImplementation(() => respondWith(fullForecast()));

      renderWidget({ ...NIEUWEGEIN, parts });

      await expect
        .element(page.getByRole("heading", { level: 2 }))
        .toBeVisible();
      expect(shownParts()).toBe(requested);
      expect(requestedUrls()[0]?.searchParams.get("parts")).toBe(requested);
    },
  );

  it.each([
    ["in any order", "daily current", "current,daily"],
    ["repeated", "hourly hourly", "hourly"],
    ["with extra whitespace", "  daily\n\thourly  ", "hourly,daily"],
    ["next to an unknown part", "weekly daily", "daily"],
    ["only unknown", "weekly", ALL_PARTS],
    ["empty", "", ALL_PARTS],
  ])(
    "asks for the Forecast parts in the fixed order when parts are %s",
    async (_, parts, requested) => {
      fakeProxy.mockImplementation(() => respondWith(fullForecast()));

      renderWidget({ ...NIEUWEGEIN, parts });

      await vi.waitFor(() => {
        expect(fakeProxy).toHaveBeenCalledOnce();
      });
      expect(requestedUrls()[0]?.searchParams.get("parts")).toBe(requested);
    },
  );

  it("sets the Forecast parts through the parts property", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));
    const widget = document.createElement("weather-widget");

    widget.latitude = 52.03;
    widget.longitude = 5.08;
    widget.parts = "daily";
    document.body.append(widget);

    await expect.element(dailyForecast()).toBeVisible();
    expect(requestedUrls()[0]?.searchParams.get("parts")).toBe("daily");
  });

  it("shows the new Forecast parts when the Host page changes them", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));
    const widget = renderWidget({ ...NIEUWEGEIN, parts: "current" });
    await expect.element(page.getByText("Feels like")).toBeVisible();

    widget.setAttribute("parts", "hourly");

    await expect.element(hourlyForecast()).toBeVisible();
    expect(page.getByText("Feels like").query()).toBeNull();
    expect(requestedUrls()[1]?.searchParams.get("parts")).toBe("hourly");
  });

  it('shows "Forecast unavailable" when the Proxy leaves out a requested Forecast part', async () => {
    const { location, parts } = forecastWith();
    fakeProxy.mockImplementation(() =>
      respondWith({ location, parts: { current: parts.current } }),
    );

    renderWidget({ ...NIEUWEGEIN, parts: "current daily" });

    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Forecast unavailable");
  });

  it.each([
    ["current", "Current conditions unavailable", "hourly,daily"],
    ["hourly", "Hourly forecast unavailable", "current,daily"],
    ["daily", "Daily forecast unavailable", "current,hourly"],
  ] as const)(
    "replaces only a failed %s part with a short message",
    async (failed, message, stillShown) => {
      fakeProxy.mockImplementation(() => respondWith(forecastFailing(failed)));

      renderWidget(NIEUWEGEIN);

      await expect.element(shownMessage(message)).toBeVisible();
      expect(shownParts()).toBe(stillShown);
      expect(
        page.getByRole("button", { name: "Try again" }).query(),
      ).toBeNull();
    },
  );

  it.each([
    ["hourly", "Next 12 hours"],
    ["daily", "Next 5 days"],
  ] as const)(
    "keeps the heading of a failed %s part",
    async (failed, heading) => {
      fakeProxy.mockImplementation(() => respondWith(forecastFailing(failed)));

      renderWidget(NIEUWEGEIN);

      await expect
        .element(page.getByRole("heading", { name: heading }))
        .toBeVisible();
    },
  );

  it("announces each failed part with the Forecast", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastFailing("hourly", "daily")),
    );

    renderWidget(NIEUWEGEIN);

    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent(
        "Forecast for Nieuwegein, updated at 10:41 AM. Hourly forecast unavailable. Daily forecast unavailable",
      );
  });

  it("announces the Forecast without an update time when Current conditions failed", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastFailing("current")));

    renderWidget(NIEUWEGEIN);

    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent(
        /^Forecast for Nieuwegein\. Current conditions unavailable$/,
      );
  });

  it('shows "Forecast unavailable" and "Try again" when every requested part failed', async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastFailing("hourly", "daily")),
    );

    renderWidget({ ...NIEUWEGEIN, parts: "hourly daily" });

    await expect
      .element(page.getByRole("button", { name: "Try again" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("status"))
      .toHaveTextContent("Forecast unavailable");
  });

  it("credits OpenWeather without Current conditions", async () => {
    fakeProxy.mockImplementation(() => respondWith(fullForecast()));

    renderWidget({ ...NIEUWEGEIN, parts: "daily" });

    await expect
      .element(page.getByRole("link", { name: "OpenWeather" }))
      .toBeVisible();
  });
});
