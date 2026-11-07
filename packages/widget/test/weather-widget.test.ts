import type {
  ForecastResponse,
  ProblemDetails,
} from "@weather-widget/contract";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import "../src/index.ts";

const NIEUWEGEIN = { latitude: "52.03", longitude: "5.08" };

const forecastWithTemperature = (
  temperatureCelsius: number,
): ForecastResponse => ({
  parts: { current: { status: "ok", data: { temperatureCelsius } } },
});

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
      .mockImplementationOnce(() => respondWith(forecastWithTemperature(7)));
    renderWidget(NIEUWEGEIN);

    await page.getByRole("button", { name: "Try again" }).click();

    await expect.element(page.getByText("7°C")).toBeVisible();
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
    document.body.append(widget);

    await expect.element(page.getByText("5°C")).toBeVisible();
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
});
