import { describe, expect, it } from "vitest";
import { renderVitestSummary, type VitestTestRow } from "./vitest-summary.ts";

const row = (overrides: Partial<VitestTestRow>): VitestTestRow => ({
  file: "test/forecast.test.ts",
  name: "the forecast route › answers with the current temperature",
  state: "passed",
  durationMs: 4.2,
  firstErrorLine: undefined,
  ...overrides,
});

describe("the Vitest job summary", () => {
  it("names the package it reports on", () => {
    expect(renderVitestSummary("Proxy", [row({})], "passed")).toContain(
      "## Proxy tests (Vitest)",
    );
  });

  it("counts the tests per result for the whole run", () => {
    const summary = renderVitestSummary(
      "Proxy",
      [
        row({}),
        row({ state: "skipped" }),
        row({ state: "failed", firstErrorLine: "boom" }),
      ],
      "failed",
    );

    expect(summary).toContain(
      "1 passed, 1 failed, 1 skipped of 3 tests (run failed).",
    );
  });

  it("shows one line per test file with its counts and total duration", () => {
    const summary = renderVitestSummary(
      "Proxy",
      [
        row({ durationMs: 4.2 }),
        row({ durationMs: 10.6 }),
        row({ file: "test/proxy.test.ts", state: "failed", durationMs: 1 }),
      ],
      "failed",
    );

    expect(summary).toContain(
      "| File | Passed | Failed | Skipped | Duration |",
    );
    expect(summary).toContain("| test/forecast.test.ts | 2 | 0 | 0 | 15 ms |");
    expect(summary).toContain("| test/proxy.test.ts | 0 | 1 | 0 | 1 ms |");
  });

  it("lists each failed test with its first error line", () => {
    const summary = renderVitestSummary(
      "Widget",
      [
        row({
          file: "test/weather-widget.test.ts",
          name: "<weather-widget> › shows the temperature",
          state: "failed",
          firstErrorLine: "AssertionError: expected 5 to be 6",
        }),
      ],
      "failed",
    );

    expect(summary).toContain("### Failures");
    expect(summary).toContain(
      "| test/weather-widget.test.ts | &lt;weather-widget&gt; › shows the temperature | AssertionError: expected 5 to be 6 |",
    );
  });

  it("leaves out the failures section when nothing failed", () => {
    expect(renderVitestSummary("Proxy", [row({})], "passed")).not.toContain(
      "### Failures",
    );
  });

  it("says so when no tests ran", () => {
    expect(renderVitestSummary("Proxy", [], "interrupted")).toContain(
      "No tests ran (run interrupted).",
    );
  });

  it("ends with a blank line so the next summary on the page starts its own block", () => {
    expect(
      renderVitestSummary("Proxy", [row({})], "passed").endsWith("\n\n"),
    ).toBe(true);
  });
});
