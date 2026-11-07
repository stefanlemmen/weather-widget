import { describe, expect, it } from "vitest";
import {
  firstLineOf,
  renderTestSummary,
  type TestRow,
} from "./test-summary.ts";

const HEADING = "## Proxy tests (Vitest)";

const row = (overrides: Partial<TestRow>): TestRow => ({
  title: "the forecast route › answers with the current temperature",
  result: "passed",
  durationMs: 136.4,
  firstErrorLine: undefined,
  ...overrides,
});

describe("a test job summary", () => {
  it("starts with the heading it is given", () => {
    expect(renderTestSummary(HEADING, [row({})], "passed")).toMatch(
      /^## Proxy tests \(Vitest\)\n/,
    );
  });

  it("lists every test with its result and duration", () => {
    const summary = renderTestSummary(HEADING, [row({})], "passed");

    expect(summary).toContain("1 passed of 1 tests (run passed).");
    expect(summary).toContain("| Test | Result | Duration |");
    expect(summary).toContain(
      "| the forecast route › answers with the current temperature | ✅ passed | 136 ms |",
    );
  });

  it("counts only passed tests as passed when tests were skipped, flaky or failed", () => {
    const summary = renderTestSummary(
      HEADING,
      [
        row({ title: "a" }),
        row({ title: "b", result: "skipped" }),
        row({ title: "c", result: "flaky" }),
        row({ title: "d", result: "failed", firstErrorLine: "boom" }),
      ],
      "failed",
    );

    expect(summary).toContain(
      "1 passed, 1 failed, 1 flaky, 1 skipped of 4 tests (run failed).",
    );
    expect(summary).toContain("| b | ⏭️ skipped |");
    expect(summary).toContain("| c | ⚠️ flaky |");
    expect(summary).toContain("| d | ❌ failed |");
  });

  it("lists each failure with its first error line", () => {
    const summary = renderTestSummary(
      HEADING,
      [
        row({
          title: "<weather-widget> › shows the temperature",
          result: "failed",
          firstErrorLine: "AssertionError: expected 5 to be 6",
        }),
      ],
      "failed",
    );

    expect(summary).toContain("### Failures");
    expect(summary).toContain(
      "| &lt;weather-widget&gt; › shows the temperature | AssertionError: expected 5 to be 6 |",
    );
  });

  it("leaves out the failures section when nothing failed", () => {
    expect(
      renderTestSummary(HEADING, [row({ result: "flaky" })], "passed"),
    ).not.toContain("### Failures");
  });

  it("says so when no tests ran", () => {
    expect(renderTestSummary(HEADING, [], "interrupted")).toContain(
      "No tests ran (run interrupted).",
    );
  });

  it("ends with a blank line so the next summary on the page starts its own block", () => {
    expect(
      renderTestSummary(HEADING, [row({})], "passed").endsWith("\n\n"),
    ).toBe(true);
  });
});

describe("the first line of an error message", () => {
  it("is the first line with text, without terminal colours", () => {
    expect(
      firstLineOf(
        "\n  \u001b[31mAssertionError: expected 5 to be 6\u001b[39m\n    at foo",
      ),
    ).toBe("AssertionError: expected 5 to be 6");
  });

  it("is missing when there is no message", () => {
    expect(firstLineOf(undefined)).toBeUndefined();
  });
});
