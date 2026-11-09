import { describe, expect, it, vi } from "vitest";
import type { Locator } from "vitest/browser";
import {
  fakeGeolocation,
  field,
  renderPicker,
  searchButton,
  useMyLocation,
} from "./support.ts";

const ROW_GAP_PX = 16;
const TARGET_PX = 44;
const NARROW_PICKER = { style: "inline-size: 280px" };

const rectOf = (locator: Locator) => locator.element().getBoundingClientRect();

describe("the Location picker's layout", () => {
  it("leaves no gap for an empty message", async () => {
    fakeGeolocation(() => undefined);
    const picker = renderPicker();
    await expect.element(useMyLocation()).toBeVisible();

    const credit = picker.shadowRoot?.querySelector(".credit");
    const rowBottom = rectOf(searchButton()).bottom;
    const creditTop = credit?.getBoundingClientRect().top ?? 0;

    expect(creditTop - rowBottom).toBeCloseTo(ROW_GAP_PX, 0);
  });

  it("puts Use my location as an icon button on the search row, after Search", async () => {
    fakeGeolocation(() => undefined);
    renderPicker();
    await expect.element(useMyLocation()).toBeVisible();

    const search = rectOf(searchButton());
    const locate = rectOf(useMyLocation());

    expect(locate.top).toBeCloseTo(search.top, 0);
    expect(locate.left).toBeGreaterThan(search.right);
    expect(locate.width).toBeGreaterThanOrEqual(TARGET_PX);
    expect(locate.height).toBeGreaterThanOrEqual(TARGET_PX);
    expect(useMyLocation().element().textContent.trim()).toBe("");
    await expect
      .element(useMyLocation())
      .toHaveAttribute("title", "Use my location");
  });

  it("drops Search and Use my location under the field together on a narrow picker", async () => {
    fakeGeolocation(() => undefined);
    renderPicker(NARROW_PICKER);
    await expect.element(useMyLocation()).toBeVisible();

    const search = rectOf(searchButton());
    const locate = rectOf(useMyLocation());

    const fieldRect = rectOf(field());

    expect(search.top).toBeGreaterThan(fieldRect.bottom);
    expect(locate.top).toBeCloseTo(search.top, 0);
    expect(search.left).toBeCloseTo(fieldRect.left, 0);
    expect(locate.right).toBeCloseTo(fieldRect.right, 0);
    expect(locate.width).toBeGreaterThanOrEqual(TARGET_PX);
  });

  it("keeps Search next to the field without the Geolocation API", async () => {
    vi.stubGlobal("navigator", {});
    renderPicker();
    await expect.element(searchButton()).toBeVisible();

    const search = rectOf(searchButton());
    const fieldRect = rectOf(field());

    expect(search.top).toBeCloseTo(fieldRect.top, 0);
    expect(search.left).toBeGreaterThan(fieldRect.right);
  });

  it("drops Search under the field at full width on a narrow picker without the Geolocation API", async () => {
    vi.stubGlobal("navigator", {});
    renderPicker(NARROW_PICKER);
    await expect.element(searchButton()).toBeVisible();

    const search = rectOf(searchButton());
    const fieldRect = rectOf(field());

    expect(search.top).toBeGreaterThan(fieldRect.bottom);
    expect(search.left).toBeCloseTo(fieldRect.left, 0);
    expect(search.right).toBeCloseTo(fieldRect.right, 0);
  });
});
