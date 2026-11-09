import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { renderPicker } from "./support.ts";

describe("the Location picker's credit", () => {
  it.each([
    ["Open-Meteo", "https://open-meteo.com/"],
    ["GeoNames", "https://www.geonames.org/"],
    ["CC BY 4.0", "https://creativecommons.org/licenses/by/4.0/"],
  ])("credits %s", async (name, href) => {
    renderPicker();

    await expect
      .element(page.getByRole("link", { name, exact: true }))
      .toHaveAttribute("href", href);
  });
});
