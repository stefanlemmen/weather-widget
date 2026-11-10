import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  answering,
  expectFocusOn,
  fakeGeolocation,
  fakeProxy,
  field,
  found,
  message,
  PARIS,
  PARIS_TEXAS,
  renderPicker,
  requestedUrls,
  respondWith,
  results,
  search,
  searchButton,
  selections,
  unavailable,
  useMyLocation,
} from "./support.ts";

describe("the Location picker's search", () => {
  it("offers a search form with a labelled field and a Search button", async () => {
    renderPicker();

    await expect
      .element(page.getByRole("search", { name: "Choose a location" }))
      .toBeVisible();
    await expect.element(field()).toBeVisible();
    await expect.element(searchButton()).toBeVisible();
  });

  it("asks the Proxy for Locations matching the trimmed term in the picker's locale", async () => {
    answering(found(PARIS));
    renderPicker();

    await search("  Paris ");

    await expect.element(results()).toBeVisible();
    const [url] = requestedUrls();
    expect(url?.pathname).toBe("/api/locations");
    expect(url?.searchParams.get("name")).toBe("Paris");
    expect(url?.searchParams.get("locale")).toBe("en");
  });

  it("asks the Proxy at its proxy-url", async () => {
    answering(found(PARIS));
    renderPicker({ "proxy-url": "https://weather.example/api" });

    await search("Paris");

    await expect.element(results()).toBeVisible();
    expect(requestedUrls()[0]?.href).toBe(
      "https://weather.example/api/locations?name=Paris&locale=en",
    );
  });

  it("searches when the Visitor presses Enter in the field", async () => {
    answering(found(PARIS));
    renderPicker();

    await userEvent.type(field(), "Paris{Enter}");

    await expect.element(results()).toBeVisible();
  });

  it("doesn't search for a blank term", async () => {
    renderPicker();

    await search("   ");

    expect(fakeProxy).not.toHaveBeenCalled();
    await expect.element(message()).toHaveTextContent("");
  });

  it("shows each Location as a button with its region and country", async () => {
    answering(found(PARIS, PARIS_TEXAS));
    renderPicker();

    await search("Paris");

    const buttons = results().getByRole("button");
    await expect
      .element(buttons.nth(0))
      .toHaveTextContent("Paris Île-de-France Region, France");
    await expect
      .element(buttons.nth(1))
      .toHaveTextContent("Paris Texas, United States");
  });

  it("shows a Location without a region or country by its name alone", async () => {
    answering(
      found({ ...PARIS, name: "Null Island", region: null, country: null }),
    );
    renderPicker();

    await search("Null Island");

    await expect
      .element(results().getByRole("button"))
      .toHaveTextContent(/^Null Island$/);
  });

  it.each([
    [[PARIS, PARIS_TEXAS], "2 locations found"],
    [[PARIS], "1 location found"],
  ])("announces how many Locations it found", async (locations, announced) => {
    answering(found(...locations));
    renderPicker();

    await search("Paris");

    await expect.element(message()).toHaveTextContent(announced);
  });

  it("announces the search while the Proxy hasn't answered yet", async () => {
    fakeProxy.mockImplementation(() => new Promise<Response>(() => undefined));
    renderPicker();

    await search(" Paris ");

    await expect.element(message()).toHaveTextContent("Searching for “Paris”…");
  });

  it("announces that it found nothing, with the term the Visitor typed", async () => {
    answering(found());
    renderPicker();

    await search("Parjs");

    await expect
      .element(message())
      .toHaveTextContent(
        "No locations found for “Parjs”. Check the spelling or try a nearby town.",
      );
    await expect.element(results()).not.toBeInTheDocument();
  });

  it.each([
    ["answers with an error", () => respondWith(unavailable, 503)],
    ["answers with an unexpected shape", () => respondWith({ places: [] })],
    ["can't be reached", () => Promise.reject(new TypeError("offline"))],
  ])("announces a failed search when the Proxy %s", async (_, respond) => {
    fakeProxy.mockImplementation(respond);
    renderPicker();

    await search("Paris");

    await expect
      .element(message())
      .toHaveTextContent(
        "Search isn't working right now. Try again in a moment.",
      );
  });

  it("shows only the latest search when an earlier one answers late", async () => {
    let answerEarlier: (response: Response) => void = () => undefined;
    const earlier = new Promise<Response>((resolve) => {
      answerEarlier = resolve;
    });
    fakeProxy
      .mockImplementationOnce(() => earlier)
      .mockImplementation(() => respondWith(found(PARIS_TEXAS)));
    renderPicker();

    await search("Paris");
    await search("Paris Texas");
    await expect.element(results()).toHaveTextContent("Texas");
    answerEarlier(Response.json(found(PARIS)));

    await expect.element(results()).not.toHaveTextContent("France");
  });

  it("emits a bubbling, composed location-select with the chosen Location", async () => {
    answering(found(PARIS, PARIS_TEXAS));
    const { selected, listener } = selections();
    renderPicker();
    await search("Paris");

    await userEvent.click(results().getByRole("button").nth(1));

    expect(selected).toEqual([
      { latitude: 33.66094, longitude: -95.55551, name: "Paris" },
    ]);
    const [event] = listener.mock.calls[0] ?? [];
    expect(event?.bubbles).toBe(true);
    expect(event?.composed).toBe(true);
  });

  it("confirms the chosen Location, clears the results and returns focus to the field", async () => {
    answering(found(PARIS, PARIS_TEXAS));
    const picker = renderPicker();
    await search("Paris");

    await userEvent.click(results().getByRole("button").nth(0));

    await expect.element(message()).toHaveTextContent("Paris chosen");
    await expect.element(results()).not.toBeInTheDocument();
    await expectFocusOn(picker, field());
  });

  it("cancels a running search when the Visitor chooses a Location", async () => {
    fakeProxy
      .mockImplementationOnce(() => respondWith(found(PARIS)))
      .mockImplementationOnce(() => new Promise<Response>(() => undefined));
    renderPicker();
    await search("Paris");
    await expect.element(results()).toBeVisible();
    await search("Paris Texas");

    await userEvent.click(results().getByRole("button").nth(0));

    expect(fakeProxy.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
    await expect.element(message()).toHaveTextContent("Paris chosen");
  });

  it("lets a Visitor using only the keyboard search and choose a Location in visual order", async () => {
    answering(found(PARIS, PARIS_TEXAS));
    fakeGeolocation(() => undefined);
    const { selected } = selections();
    const picker = renderPicker();

    await userEvent.tab();
    await expectFocusOn(picker, field());
    await userEvent.keyboard("Paris");
    await userEvent.tab();
    await expectFocusOn(picker, searchButton());
    await userEvent.keyboard("{Enter}");
    await expect.element(results()).toBeVisible();
    await userEvent.tab();
    await expectFocusOn(picker, useMyLocation());
    await userEvent.tab();
    await expectFocusOn(picker, results().getByRole("button").nth(0));
    await userEvent.keyboard("{Enter}");

    expect(selected).toEqual([
      { latitude: 48.85341, longitude: 2.3488, name: "Paris" },
    ]);
  });
});
