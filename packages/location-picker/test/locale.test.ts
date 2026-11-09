import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  answering,
  fakeGeolocation,
  fakeProxy,
  found,
  message,
  PARIS,
  renderPicker,
  requestedUrls,
  searchButton,
} from "./support.ts";

describe("the Location picker's locale", () => {
  it("speaks Dutch in a Dutch picker and searches in Dutch", async () => {
    answering(found(PARIS));
    fakeGeolocation(() => undefined);
    renderPicker({ locale: "nl" });

    await expect
      .element(page.getByRole("search", { name: "Kies een locatie" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Gebruik mijn locatie" }))
      .toBeVisible();
    await userEvent.fill(
      page.getByRole("searchbox", { name: "Locatie" }),
      "Parijs",
    );
    await userEvent.click(page.getByRole("button", { name: "Zoeken" }));

    await expect.element(message()).toHaveTextContent("1 locatie gevonden");
    expect(requestedUrls()[0]?.searchParams.get("locale")).toBe("nl");

    await userEvent.click(
      page.getByRole("list", { name: "Gevonden locaties" }).getByRole("button"),
    );

    await expect.element(message()).toHaveTextContent("Paris gekozen");
  });

  it("announces a running search in Dutch", async () => {
    fakeProxy.mockImplementation(() => new Promise<Response>(() => undefined));
    renderPicker({ locale: "nl" });

    await userEvent.fill(
      page.getByRole("searchbox", { name: "Locatie" }),
      "Parijs",
    );
    await userEvent.click(page.getByRole("button", { name: "Zoeken" }));

    await expect.element(message()).toHaveTextContent("Zoeken naar ‘Parijs’…");
  });

  it("falls back to English for an unknown locale", async () => {
    renderPicker({ locale: "fr" });

    await expect.element(searchButton()).toBeVisible();
  });
});
