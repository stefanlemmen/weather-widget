import { describe, expect, it } from "vitest";
import {
  firstLineOf,
  renderTestSummary,
  type TestRow,
} from "./test-summary.ts";

const HEADING = "## Proxy tests (Vitest)";
const FILE = "packages/proxy/test/forecast.test.ts";
const SHA = "4106403736223f0c551d8502265696f6d6a31321";
const SOURCE_URL = `https://github.com/owner/repo/blob/${SHA}`;

const row = (overrides: Partial<TestRow>): TestRow => ({
  file: FILE,
  line: 12,
  title: "the forecast route › answers with the current temperature",
  result: "passed",
  durationMs: 136.4,
  firstErrorLine: undefined,
  ...overrides,
});

const render = (
  rows: readonly TestRow[],
  status = "passed",
  sourceUrl?: string,
) => renderTestSummary({ heading: HEADING, rows, status, sourceUrl });

describe("a test job summary", () => {
  it("starts with the heading it is given", () => {
    expect(render([row({})])).toMatch(/^## Proxy tests \(Vitest\)\n/);
  });

  it("lists every test with its file, result and duration in their own columns", () => {
    const summary = render([row({})]);

    expect(summary).toContain("1 passed of 1 tests (run passed).");
    expect(summary).toContain("| File | Test | Result | Duration |");
    expect(summary).toContain(
      "| forecast.test.ts - L12 | the forecast route › answers with the current temperature | ✅ passed | 136 ms |",
    );
  });

  it("names and links the line in the source that defines each test", () => {
    expect(render([row({})], "passed", SOURCE_URL)).toContain(
      `| [forecast.test.ts - L12](${SOURCE_URL}/${FILE}#L12) | the forecast route › answers with the current temperature | ✅ passed |`,
    );
  });

  it("names and links only the file when the line of a test is unknown", () => {
    expect(render([row({ line: undefined })], "passed", SOURCE_URL)).toContain(
      `| [forecast.test.ts](${SOURCE_URL}/${FILE}) | the forecast`,
    );
  });

  it("counts only passed tests as passed when tests were skipped, flaky or failed", () => {
    const summary = render(
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
    expect(summary).toContain("| forecast.test.ts - L12 | b | ⏭️ skipped |");
    expect(summary).toContain("| forecast.test.ts - L12 | c | ⚠️ flaky |");
    expect(summary).toContain("| forecast.test.ts - L12 | d | ❌ failed |");
  });

  it("lists each failure with its linked file and first error line", () => {
    const summary = render(
      [
        row({
          file: "packages/widget/test/weather-widget.test.ts",
          line: 40,
          title: "<weather-widget> › shows the temperature",
          result: "failed",
          firstErrorLine: "AssertionError: expected 5 to be 6",
        }),
      ],
      "failed",
      SOURCE_URL,
    );

    expect(summary).toContain("### Failures");
    expect(summary).toContain("| File | Test | Error |");
    expect(summary).toContain(
      `| [weather-widget.test.ts - L40](${SOURCE_URL}/packages/widget/test/weather-widget.test.ts#L40) | &lt;weather-widget&gt; › shows the temperature | AssertionError: expected 5 to be 6 |`,
    );
  });

  it("leaves out the failures section when nothing failed", () => {
    expect(render([row({ result: "flaky" })])).not.toContain("### Failures");
  });

  it("says so when no tests ran", () => {
    expect(render([], "interrupted")).toContain(
      "No tests ran (run interrupted).",
    );
  });

  it("ends with a blank line so the next summary on the page starts its own block", () => {
    expect(render([row({})]).endsWith("\n\n")).toBe(true);
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
