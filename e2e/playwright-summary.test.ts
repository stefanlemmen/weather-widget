import { describe, expect, it } from "vitest";
import {
  renderPlaywrightSummary,
  type PlaywrightTestRow,
} from "./playwright-summary.ts";

const row = (overrides: Partial<PlaywrightTestRow>): PlaywrightTestRow => ({
  title: "vanilla Example host › shows the temperature",
  outcome: "expected",
  durationMs: 136.4,
  firstErrorLine: undefined,
  ...overrides,
});

describe("the Playwright job summary", () => {
  it("lists every test with its result and duration", () => {
    const summary = renderPlaywrightSummary([row({})], "passed");

    expect(summary).toContain("1 passed of 1 tests (run passed).");
    expect(summary).toContain(
      "| vanilla Example host › shows the temperature | ✅ passed | 136 ms |",
    );
    expect(summary).not.toContain("### Failures");
  });

  it("counts only passed tests as passed when tests were skipped, flaky or failed", () => {
    const summary = renderPlaywrightSummary(
      [
        row({ title: "a" }),
        row({ title: "b", outcome: "skipped" }),
        row({ title: "c", outcome: "flaky" }),
        row({ title: "d", outcome: "unexpected", firstErrorLine: "boom" }),
      ],
      "failed",
    );

    expect(summary).toContain(
      "1 passed, 1 failed, 1 flaky, 1 skipped of 4 tests (run failed).",
    );
  });

  it("reports a run that timed out before most tests ran", () => {
    const summary = renderPlaywrightSummary(
      [row({ title: "a" }), row({ title: "b", outcome: "skipped" })],
      "timedout",
    );

    expect(summary).toContain("1 passed, 1 skipped of 2 tests (run timedout).");
  });

  it("lists each failure with its first error line", () => {
    const summary = renderPlaywrightSummary(
      [
        row({
          title: "shows the temperature",
          outcome: "unexpected",
          firstErrorLine: "Error: expect(locator).toBeVisible() failed",
        }),
      ],
      "failed",
    );

    expect(summary).toContain("### Failures");
    expect(summary).toContain(
      "| shows the temperature | Error: expect(locator).toBeVisible() failed |",
    );
  });

  it("says so when no tests ran", () => {
    expect(renderPlaywrightSummary([], "failed")).toContain(
      "No tests ran (run failed).",
    );
  });

  it("ends with a blank line so the next summary on the page starts its own block", () => {
    expect(renderPlaywrightSummary([row({})], "passed").endsWith("\n\n")).toBe(
      true,
    );
  });
});
