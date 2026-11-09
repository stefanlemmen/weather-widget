import { describe, expect, it } from "vitest";
import { fakeGeolocation, renderPicker, useMyLocation } from "./support.ts";

describe("the Location picker's layout", () => {
  const ROW_GAP_PX = 16;

  it("leaves no gap for an empty message", async () => {
    fakeGeolocation(() => undefined);
    const picker = renderPicker();
    await expect.element(useMyLocation()).toBeVisible();

    const credit = picker.shadowRoot?.querySelector(".credit");
    const locateBottom = useMyLocation()
      .element()
      .getBoundingClientRect().bottom;
    const creditTop = credit?.getBoundingClientRect().top ?? 0;

    expect(creditTop - locateBottom).toBeCloseTo(ROW_GAP_PX, 0);
  });
});
