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
import { afterEach, beforeEach, vi } from "vitest";
import { page } from "vitest/browser";
import { WeatherWidget } from "../src/index.ts";

export const NIEUWEGEIN = { latitude: "52.03", longitude: "5.08" };

export const RECORDED_CONDITIONS: CurrentConditions = {
  condition: "overcast",
  daylight: "day",
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

export const RECORDED_AT = "2026-11-08T09:41:44.000Z";
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;
const CONDITION_CYCLE: readonly Condition[] = [
  "rain",
  "overcast",
  "partly-cloudy",
  "clear",
];

export const hoursFrom = (firstHourStartsAt: string, count = 20): Hour[] =>
  Array.from({ length: count }, (_, index) => ({
    startsAt: new Date(
      Date.parse(firstHourStartsAt) + index * MILLISECONDS_PER_HOUR,
    ).toISOString(),
    condition: CONDITION_CYCLE[index % CONDITION_CYCLE.length] ?? "unknown",
    daylight: "day",
    temperatureCelsius: 30.75 + index,
    precipitationChance: index === 0 ? 0.85 : 0,
  }));

export const daysFrom = (firstDate: string, count = 10): Day[] =>
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

export const forecastWith = (
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

export const fullForecast = () =>
  forecastWith({}, {}, { hours: RECORDED_HOURS, days: RECORDED_DAYS });

export const forecastIn = (
  timeZone: string,
  forecast: { hours?: Hour[]; days?: Day[] },
) => forecastWith({}, { timeZone }, forecast);

export const forecastWithTemperature = (temperatureCelsius: number) =>
  forecastWith({ temperatureCelsius });

export const unavailable: ProblemDetails = {
  type: "about:blank",
  title: "Forecast unavailable",
  status: 503,
};

const FAILED_PART = { status: "error" } as const;

export const forecastFailing = (...failed: readonly ForecastPart[]) => {
  const forecast = fullForecast();
  return {
    ...forecast,
    parts: {
      ...forecast.parts,
      ...Object.fromEntries(failed.map((part) => [part, FAILED_PART])),
    },
  };
};

export const shownMessage = (text: string) =>
  page.getByRole("paragraph").filter({ hasText: text });

export const errorHeading = (text: string) =>
  page.getByRole("heading", { level: 3, name: text });

export const announcement = () => page.getByRole("status");

export const weatherProviderCredit = () =>
  page.getByRole("link", {
    name: "Weather data provided by OpenWeather",
    exact: true,
  });

export const locationName = () => page.getByRole("heading", { level: 2 });

export const respondWith = (body: unknown, status = 200) =>
  Promise.resolve(Response.json(body, { status }));

export const fakeProxy = vi.fn<typeof fetch>();

export const urlOf = (input: RequestInfo | URL) =>
  new URL(input instanceof Request ? input.url : input, document.baseURI);

export const requestedUrls = () =>
  fakeProxy.mock.calls.map(([input]) => urlOf(input));

const observers = new Set<FakeIntersectionObserver>();
const RealIntersectionObserver = IntersectionObserver;

class FakeIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly scrollMargin = "0px";
  readonly thresholds = [0];
  readonly observed = new Set<Element>();
  readonly #callback: IntersectionObserverCallback;
  readonly #real: IntersectionObserver;

  constructor(
    callback: IntersectionObserverCallback,
    options: IntersectionObserverInit = {},
  ) {
    this.#callback = callback;
    this.#real = new RealIntersectionObserver(callback, options);
    this.rootMargin = options.rootMargin ?? "0px";
    observers.add(this);
  }

  observe(target: Element) {
    if (target instanceof WeatherWidget) this.observed.add(target);
    else this.#real.observe(target);
  }

  unobserve(target: Element) {
    this.observed.delete(target);
    this.#real.unobserve(target);
  }

  disconnect() {
    this.observed.clear();
    this.#real.disconnect();
  }

  takeRecords() {
    return this.#real.takeRecords();
  }

  intersect(target: Element) {
    if (!this.observed.has(target)) return;
    const bounds = target.getBoundingClientRect();
    this.#callback(
      [
        {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: bounds,
          intersectionRect: bounds,
          rootBounds: null,
          time: performance.now(),
        },
      ],
      this,
    );
  }
}

export const nearViewport = (widget: Element) => {
  for (const observer of observers) observer.intersect(widget);
};

export const renderFarFromViewport = (
  attributes: Readonly<Record<string, string>>,
) => {
  const widget = document.createElement("weather-widget");
  for (const [name, value] of Object.entries(attributes)) {
    widget.setAttribute(name, value);
  }
  document.body.append(widget);
  return widget;
};

export const renderWidget = (attributes: Readonly<Record<string, string>>) => {
  const widget = renderFarFromViewport(attributes);
  nearViewport(widget);
  return widget;
};

let visibility: DocumentVisibilityState = "visible";

export const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
};

export const ALL_PARTS = "current,hourly,daily";

beforeEach(() => {
  fakeProxy.mockReset();
  vi.stubGlobal("fetch", fakeProxy);
  observers.clear();
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(
    () => visibility,
  );
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(RECORDED_AT);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

export const hourlyForecast = () =>
  page.getByRole("list", { name: "Next 12 hours" });
export const dailyForecast = () =>
  page.getByRole("list", { name: "Next 5 days" });

export const textsOf = (
  list: ReturnType<typeof page.getByRole>,
  selector: string,
) =>
  Array.from(list.element().querySelectorAll(selector), (element) =>
    element.textContent.trim(),
  );

export const conditionsShownIn = (list: ReturnType<typeof page.getByRole>) =>
  list
    .getByRole("img")
    .elements()
    .map((icon) => icon.getAttribute("aria-label"));
