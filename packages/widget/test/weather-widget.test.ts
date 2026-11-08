import { afterEach, describe, expect, it, vi } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import {
  NIEUWEGEIN,
  forecastWith,
  fullForecast,
  forecastWithTemperature,
  unavailable,
  forecastFailing,
  errorHeading,
  announcement,
  locationName,
  respondWith,
  fakeProxy,
  urlOf,
  requestedUrls,
  nearViewport,
  renderWidget,
  ALL_PARTS,
} from "./support.ts";

describe("<weather-widget>", () => {
  it("shows the current temperature for the Location its Host page sets", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastWithTemperature(5.09)),
    );

    renderWidget(NIEUWEGEIN);

    await expect.element(page.getByText("5°")).toBeVisible();
    const [url] = requestedUrls();
    expect(url?.pathname).toBe("/api/forecast");
    expect(url?.searchParams.get("latitude")).toBe("52.03");
    expect(url?.searchParams.get("longitude")).toBe("5.08");
    expect(url?.searchParams.get("parts")).toBe(ALL_PARTS);
  });

  it("asks the Proxy at the address set in proxy-url", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWithTemperature(5)));

    renderWidget({ ...NIEUWEGEIN, "proxy-url": "https://proxy.example/api" });

    await expect.element(page.getByText("5°")).toBeVisible();
    expect(requestedUrls()[0]?.href).toBe(
      `https://proxy.example/api/forecast?latitude=52.03&longitude=5.08&parts=${encodeURIComponent(ALL_PARTS)}`,
    );
  });

  it.each([
    [12.5, "13°"],
    [-3.4, "−3°"],
    [-0.4, "0°"],
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

    await expect.element(announcement()).toHaveTextContent("Loading forecast");
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

    await expect.element(errorHeading("Forecast unavailable")).toBeVisible();
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

    await expect.element(page.getByText("11°")).toBeVisible();
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

    const retryingAfterFailure = async () => {
      fakeProxy.mockImplementationOnce(() => respondWith(unavailable, 503));
      const widget = renderWidget(NIEUWEGEIN);
      const answer = answerLater();
      const tryAgain = page.getByRole("button", { name: "Try again" });
      await tryAgain.click();
      expect(focusedIn(widget)).toBe(tryAgain.element());
      return { widget, answer, tryAgain: tryAgain.element() };
    };

    const nameTakesFocus = (widget: HTMLElement) =>
      vi.waitFor(() => {
        expect(focusedIn(widget)).toBe(locationName().element());
      });

    it("stays on Try again while the Widget fetches again and when it fails again", async () => {
      const { widget, answer, tryAgain } = await retryingAfterFailure();

      await expect
        .element(announcement())
        .toHaveTextContent("Loading forecast");
      expect(focusedIn(widget)).toBe(tryAgain);

      answer(Response.json(unavailable, { status: 503 }));

      await expect
        .element(announcement())
        .toHaveTextContent("Forecast unavailable");
      expect(focusedIn(widget)).toBe(tryAgain);
    });

    it("moves to the Location's name when the Forecast arrives", async () => {
      const { widget, answer } = await retryingAfterFailure();

      answer(Response.json(fullForecast()));

      await expect.element(locationName()).toBeVisible();
      await nameTakesFocus(widget);
    });

    it("leaves the Forecast's announcement to the focused name", async () => {
      const { widget, answer } = await retryingAfterFailure();

      answer(Response.json(fullForecast()));

      await nameTakesFocus(widget);
      expect(announcement().element().textContent.trim()).toBe("");
    });

    it("still announces the failed parts when focus moves to the name", async () => {
      const { widget, answer } = await retryingAfterFailure();

      answer(Response.json(forecastFailing("daily")));

      await expect
        .element(announcement())
        .toHaveTextContent(/^Daily forecast unavailable$/);
      expect(focusedIn(widget)).toBe(locationName().element());
    });

    it("keeps the announcement when the Host page renames the Location after focus moved", async () => {
      const { widget, answer } = await retryingAfterFailure();
      answer(Response.json(fullForecast()));
      await nameTakesFocus(widget);

      widget.setAttribute("location-name", "Home");

      await expect.element(locationName()).toHaveTextContent("Home");
      expect(announcement().element().textContent.trim()).toBe("");
    });

    it("stays where the visitor moved it while the Widget fetched", async () => {
      const { widget, answer } = await retryingAfterFailure();
      const elsewhere = document.createElement("input");
      document.body.append(elsewhere);
      elsewhere.focus();

      answer(Response.json(fullForecast()));

      await expect.element(locationName()).toBeVisible();
      await widget.updateComplete;
      expect(document.activeElement).toBe(elsewhere);
      await expect
        .element(announcement())
        .toHaveTextContent("Forecast for Nieuwegein, updated at 10:41 AM");
    });

    it("stays on Try again when the Host page changes the Location while it fetches", async () => {
      const { widget, tryAgain } = await retryingAfterFailure();

      widget.setAttribute("latitude", "35.68");
      await widget.updateComplete;

      expect(focusedIn(widget)).toBe(tryAgain);
    });

    it("fetches only once when the visitor presses Try again while it fetches", async () => {
      await retryingAfterFailure();
      await expect
        .element(announcement())
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
    await expect.element(page.getByText("5°")).toBeVisible();

    widget.setAttribute("latitude", "35.68");
    widget.setAttribute("longitude", "139.69");

    await expect.element(page.getByText("18°")).toBeVisible();
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
    await expect.element(page.getByText("18°")).toBeVisible();
    const lateAnswer = Response.json(forecastWithTemperature(5));
    answerNieuwegein(lateAnswer);
    await vi.waitFor(() => {
      expect(lateAnswer.bodyUsed).toBe(true);
    });
    await new Promise((settle) => setTimeout(settle));
    await widget.updateComplete;

    expect(page.getByText("18°").query()).not.toBeNull();
    expect(page.getByText("5°").query()).toBeNull();
  });

  it("matches every attribute with a property", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWithTemperature(5)));
    const widget = document.createElement("weather-widget");

    widget.latitude = 52.03;
    widget.longitude = 5.08;
    widget.proxyUrl = "https://proxy.example/api";
    widget.locationName = "Home";
    widget.parts = "current hourly daily";
    widget.locale = "nl";
    widget.units = "imperial";
    document.body.append(widget);
    nearViewport(widget);

    await expect.element(page.getByText("41°")).toBeVisible();
    await expect.element(locationName()).toHaveTextContent("Home");
    expect(page.getByText("Gevoelstemperatuur").query()).not.toBeNull();
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
        .element(announcement())
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

      await expect.element(page.getByText("−30°")).toBeVisible();
    },
  );

  it("shows the Forecast once the Host page completes the Location", async () => {
    fakeProxy.mockImplementation(() => respondWith(forecastWithTemperature(5)));
    const widget = renderWidget({ latitude: "52.03" });
    await widget.updateComplete;

    widget.setAttribute("longitude", "5.08");

    await expect.element(page.getByText("5°")).toBeVisible();
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
    const liveRegion = announcement();
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
    const liveRegion = announcement();
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

  describe("the Location's name", () => {
    it("names the Location with the name the Proxy found", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));

      renderWidget(NIEUWEGEIN);

      await expect.element(locationName()).toHaveTextContent("Nieuwegein");
    });

    it("prefers the name the Host page sets in location-name", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));

      renderWidget({ ...NIEUWEGEIN, "location-name": "Home" });

      await expect.element(locationName()).toHaveTextContent("Home");
    });

    it("ignores a blank location-name", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));

      renderWidget({ ...NIEUWEGEIN, "location-name": "   " });

      await expect.element(locationName()).toHaveTextContent("Nieuwegein");
    });

    it("updates the name when the Host page changes location-name", async () => {
      fakeProxy.mockImplementation(() => respondWith(forecastWith()));
      const widget = renderWidget({ ...NIEUWEGEIN, "location-name": "Home" });
      await expect.element(locationName()).toHaveTextContent("Home");

      widget.removeAttribute("location-name");

      await expect.element(locationName()).toHaveTextContent("Nieuwegein");
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

        await expect.element(locationName()).toHaveTextContent(shown);
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
        .element(announcement())
        .toHaveTextContent("Forecast for Nieuwegein, updated at 10:41 AM");
    });

    it("announces the Forecast for the Location's coordinates in full when the Proxy found no name", async () => {
      fakeProxy.mockImplementation(() =>
        respondWith(forecastWith({}, { name: null })),
      );

      renderWidget(NIEUWEGEIN);

      await expect
        .element(announcement())
        .toHaveTextContent(
          "Forecast for 52.03 degrees north, 5.08 degrees east, updated at 10:41 AM",
        );
    });
  });
});

describe("color scheme", () => {
  afterEach(async () => {
    await commands.emulateMedia({ colorScheme: "light" });
  });

  it.each([
    ["light", "rgb(238, 243, 249)", "rgb(19, 36, 58)", "rgb(23, 112, 63)"],
    ["dark", "rgb(22, 38, 59)", "rgb(242, 245, 249)", "rgb(111, 220, 155)"],
  ] as const)(
    "paints its own ground, ink and accent link in the %s scheme, so the OpenWeather link stays readable",
    async (colorScheme, ground, ink, accent) => {
      await commands.emulateMedia({ colorScheme });
      fakeProxy.mockImplementation(() => respondWith(fullForecast()));

      const widget = renderWidget(NIEUWEGEIN);

      const link = page.getByRole("link", { name: "OpenWeather" });
      await expect.element(link).toBeVisible();
      expect(getComputedStyle(widget).backgroundColor).toBe(ground);
      expect(getComputedStyle(widget).color).toBe(ink);
      expect(getComputedStyle(link.element()).color).toBe(accent);
    },
  );
});
