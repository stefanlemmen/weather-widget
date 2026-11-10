import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  NIEUWEGEIN,
  RECORDED_CURRENT_WEATHER,
  RECORDED_AT,
  fullForecast,
  forecastWithTemperature,
  unavailable,
  forecastFailing,
  shownMessage,
  announcement,
  locationName,
  respondWith,
  fakeProxy,
  urlOf,
  requestedUrls,
  nearViewport,
  renderFarFromViewport,
  renderWidget,
  setVisibility,
  ALL_PARTS,
} from "./support.ts";

describe("loading", () => {
  it("fetches only once the Widget nears the viewport", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastWithTemperature(15)),
    );
    const widget = renderFarFromViewport(NIEUWEGEIN);
    await widget.updateComplete;

    expect(fakeProxy).not.toHaveBeenCalled();

    nearViewport(widget);

    await expect.element(page.getByText("15°")).toBeVisible();
    expect(fakeProxy).toHaveBeenCalledTimes(1);
  });

  describe("skeleton", () => {
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

    const heightOf = (element: Element) =>
      element.getBoundingClientRect().height;

    it("takes the Forecast's size while loading, so nothing shifts when it arrives", async () => {
      const answer = answerLater();
      const widget = renderWidget(NIEUWEGEIN);
      await widget.updateComplete;
      const loadingHeight = heightOf(widget);

      answer(Response.json(fullForecast()));

      await expect.element(locationName()).toBeVisible();
      expect(heightOf(widget)).toBe(loadingHeight);
    });

    it("leaves out the Forecast parts the Host page didn't ask for", async () => {
      const answer = answerLater();
      const widget = renderWidget({ ...NIEUWEGEIN, parts: "current" });
      await widget.updateComplete;
      const loadingHeight = heightOf(widget);

      answer(Response.json(fullForecast()));

      await expect.element(locationName()).toBeVisible();
      expect(heightOf(widget)).toBe(loadingHeight);
    });

    it("draws its placeholder text in transparent ink while loading", async () => {
      answerLater();
      const widget = renderWidget(NIEUWEGEIN);
      await widget.updateComplete;

      const skeleton = widget.shadowRoot?.querySelector(".skeleton");
      if (!skeleton) throw new Error("The Widget shows no skeleton");
      const placeholders = [skeleton, ...skeleton.querySelectorAll("*")].filter(
        (element) =>
          Array.from(element.childNodes).some(
            (node) =>
              node.nodeType === Node.TEXT_NODE &&
              node.textContent?.trim() !== "",
          ),
      );
      expect(placeholders.length).toBeGreaterThan(0);
      expect(
        placeholders
          .filter(
            (element) => getComputedStyle(element).color !== "rgba(0, 0, 0, 0)",
          )
          .map((element) => element.textContent.trim()),
      ).toEqual([]);
    });

    it("marks the Widget busy and hides the placeholder from screen readers", async () => {
      const answer = answerLater();
      const widget = renderWidget(NIEUWEGEIN);
      await widget.updateComplete;

      expect(widget).toHaveAttribute("aria-busy", "true");
      await expect.element(locationName()).not.toBeInTheDocument();
      await expect.element(page.getByRole("link")).not.toBeInTheDocument();

      answer(Response.json(fullForecast()));

      await expect.element(locationName()).toBeVisible();
      expect(widget).not.toHaveAttribute("aria-busy");
    });
  });

  it("fetches the Location the Host page set last once it nears the viewport", async () => {
    fakeProxy.mockImplementation(() =>
      respondWith(forecastWithTemperature(15)),
    );
    const widget = renderFarFromViewport(NIEUWEGEIN);
    widget.setAttribute("latitude", "35.68");
    await widget.updateComplete;

    nearViewport(widget);

    await expect.element(page.getByText("15°")).toBeVisible();
    expect(
      requestedUrls().map((url) => url.searchParams.get("latitude")),
    ).toEqual(["35.68"]);
  });

  it("fetches again when the Host page moves it while it was loading", async () => {
    fakeProxy.mockImplementationOnce(() => new Promise(() => undefined));
    const widget = renderWidget(NIEUWEGEIN);
    await widget.updateComplete;
    fakeProxy.mockImplementationOnce(() =>
      respondWith(forecastWithTemperature(15)),
    );

    widget.remove();
    document.body.append(widget);

    await expect.element(page.getByText("15°")).toBeVisible();
  });

  it("lets several Widgets on one page load and fail independently", async () => {
    const TOKYO = { latitude: "35.68", longitude: "139.69" };
    fakeProxy.mockImplementation((input) =>
      urlOf(input).searchParams.get("latitude") === TOKYO.latitude
        ? respondWith(unavailable, 503)
        : respondWith(fullForecast()),
    );
    const nieuwegein = renderWidget({ ...NIEUWEGEIN, parts: "daily" });
    const tokyo = renderFarFromViewport({ ...TOKYO, "location-name": "Tokyo" });
    const inNieuwegein = page.elementLocator(nieuwegein);
    const inTokyo = page.elementLocator(tokyo);

    await expect
      .element(inNieuwegein.getByRole("list", { name: "Next 5 days" }))
      .toBeVisible();
    expect(requestedUrls()).toHaveLength(1);

    nearViewport(tokyo);

    await expect
      .element(inTokyo.getByRole("button", { name: "Try again" }))
      .toBeVisible();
    await expect
      .element(inNieuwegein.getByRole("list", { name: "Next 5 days" }))
      .toBeVisible();
    expect(requestedUrls().map((url) => url.searchParams.get("parts"))).toEqual(
      ["daily", ALL_PARTS],
    );
  });

  describe("when the page becomes visible again", () => {
    const MILLISECONDS_PER_MINUTE = 60 * 1000;

    const minutesLater = (minutes: number) => {
      vi.setSystemTime(
        Date.parse(RECORDED_AT) + minutes * MILLISECONDS_PER_MINUTE,
      );
    };

    const comeBackAfter = (minutes: number) => {
      setVisibility("hidden");
      minutesLater(minutes);
      setVisibility("visible");
    };

    const fifteenDegreesWithoutDailyForecast = () => {
      const failing = forecastFailing("daily");
      return {
        ...failing,
        parts: {
          ...failing.parts,
          current: {
            status: "ok",
            data: { ...RECORDED_CURRENT_WEATHER, temperatureCelsius: 15 },
          },
        },
      };
    };

    const showingFiveDegrees = async () => {
      fakeProxy.mockImplementationOnce(() =>
        respondWith(forecastWithTemperature(5)),
      );
      const widget = renderWidget(NIEUWEGEIN);
      await expect.element(page.getByText("5°")).toBeVisible();
      return widget;
    };

    it("fetches again when the Forecast is more than 10 minutes old", async () => {
      await showingFiveDegrees();
      fakeProxy.mockImplementationOnce(() =>
        respondWith(forecastWithTemperature(9)),
      );

      comeBackAfter(11);

      await expect.element(page.getByText("9°")).toBeVisible();
      expect(fakeProxy).toHaveBeenCalledTimes(2);
    });

    it("keeps the Forecast and its Update time when the refresh fails, and tries again next time", async () => {
      await showingFiveDegrees();
      fakeProxy.mockImplementationOnce(() => respondWith(unavailable, 503));

      comeBackAfter(11);

      await vi.waitFor(() => {
        expect(fakeProxy).toHaveBeenCalledTimes(2);
      });
      await expect.element(page.getByText("5°")).toBeVisible();
      await expect
        .element(shownMessage("Updated at"))
        .toHaveTextContent("Updated at 10:41 AM");
      await expect
        .element(announcement())
        .toHaveTextContent(/^Forecast for Nieuwegein, updated at 10:41 AM$/);

      fakeProxy.mockImplementationOnce(() =>
        respondWith(forecastWithTemperature(9)),
      );
      comeBackAfter(12);

      await expect.element(page.getByText("9°")).toBeVisible();
    });

    it("keeps a part on screen when the refresh couldn't get it", async () => {
      fakeProxy.mockImplementationOnce(() => respondWith(fullForecast()));
      renderWidget(NIEUWEGEIN);
      const days = page.getByRole("list", { name: "Next 5 days" });
      await expect.element(days).toBeVisible();
      fakeProxy.mockImplementationOnce(() =>
        respondWith(fifteenDegreesWithoutDailyForecast()),
      );

      comeBackAfter(11);

      await expect.element(page.getByText("15°")).toBeVisible();
      await expect.element(days).toBeVisible();
      await expect
        .element(shownMessage("Daily forecast unavailable"))
        .not.toBeInTheDocument();
    });

    it("tries again next time when the refresh couldn't get every part", async () => {
      fakeProxy.mockImplementationOnce(() => respondWith(fullForecast()));
      renderWidget(NIEUWEGEIN);
      await expect.element(locationName()).toBeVisible();
      fakeProxy.mockImplementationOnce(() =>
        respondWith(fifteenDegreesWithoutDailyForecast()),
      );
      comeBackAfter(11);
      await expect.element(page.getByText("15°")).toBeVisible();
      fakeProxy.mockImplementationOnce(() => respondWith(fullForecast()));

      comeBackAfter(13);

      await vi.waitFor(() => {
        expect(fakeProxy).toHaveBeenCalledTimes(3);
      });
    });

    it("keeps the Forecast without fetching when it is 10 minutes old or less", async () => {
      const widget = await showingFiveDegrees();

      comeBackAfter(10);
      await widget.updateComplete;

      expect(fakeProxy).toHaveBeenCalledTimes(1);
      await expect.element(page.getByText("5°")).toBeVisible();
    });
  });
});
