import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  fakeGeolocation,
  message,
  POSITION_ERROR_CODES,
  positionAt,
  positionError,
  renderPicker,
  searchButton,
  selections,
  useMyLocation,
} from "./support.ts";

describe("the Location picker's device Location", () => {
  it("offers Use my location when the Geolocation API exists", async () => {
    fakeGeolocation(() => undefined);
    renderPicker();

    await expect.element(useMyLocation()).toBeVisible();
  });

  it("leaves out Use my location without the Geolocation API", async () => {
    vi.stubGlobal("navigator", {});
    renderPicker();

    await expect.element(searchButton()).toBeVisible();
    await expect.element(useMyLocation()).not.toBeInTheDocument();
  });

  it("emits the device's Location rounded to 2 decimals and without a name", async () => {
    fakeGeolocation((success) => {
      success(positionAt(52.034_91, 5.075_12));
    });
    const { selected } = selections();
    renderPicker();

    await userEvent.click(useMyLocation());

    expect(selected).toEqual([
      { latitude: 52.03, longitude: 5.08, name: null },
    ]);
  });

  it("asks the device once while it finds the Location, and says so", async () => {
    const getCurrentPosition = fakeGeolocation(() => undefined);
    renderPicker();

    await userEvent.click(useMyLocation());
    useMyLocation().element().dispatchEvent(new MouseEvent("click"));

    await expect
      .element(useMyLocation())
      .toHaveAttribute("aria-disabled", "true");
    await expect.element(message()).toHaveTextContent("Finding your location…");
    expect(getCurrentPosition).toHaveBeenCalledOnce();
  });

  it("asks the device with a time limit", async () => {
    const getCurrentPosition = fakeGeolocation(() => undefined);
    renderPicker();

    await userEvent.click(useMyLocation());

    expect(getCurrentPosition.mock.calls[0]?.[2]?.timeout).toBeGreaterThan(0);
  });

  it("clears the message and lets the visitor locate again once found", async () => {
    fakeGeolocation((success) => {
      success(positionAt(52.03, 5.08));
    });
    renderPicker();

    await userEvent.click(useMyLocation());

    await expect
      .element(useMyLocation())
      .not.toHaveAttribute("aria-disabled", "true");
    await expect.element(message()).toHaveTextContent("");
  });

  it.each([
    [
      "denied",
      POSITION_ERROR_CODES.PERMISSION_DENIED,
      "Location access is off. You can turn it on in your browser settings.",
    ],
    [
      "timed out",
      POSITION_ERROR_CODES.TIMEOUT,
      "Finding your location took too long. Try again.",
    ],
    [
      "unavailable",
      POSITION_ERROR_CODES.POSITION_UNAVAILABLE,
      "Your device couldn't find its location. Try again or search by name.",
    ],
  ])(
    "announces a %s device Location and emits nothing",
    async (_, code, announced) => {
      fakeGeolocation((_success, failure) => {
        failure(positionError(code));
      });
      const { selected } = selections();
      renderPicker();

      await userEvent.click(useMyLocation());

      await expect.element(message()).toHaveTextContent(announced);
      await expect
        .element(useMyLocation())
        .not.toHaveAttribute("aria-disabled", "true");
      expect(selected).toEqual([]);
    },
  );
});
