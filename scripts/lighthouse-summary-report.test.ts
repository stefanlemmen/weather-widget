import { describe, expect, it } from "vitest";
import {
  renderLighthouseSummary,
  type LighthouseRun,
} from "./lighthouse-summary-report.ts";

const VANILLA = "http://localhost:4173/vanilla/";
const REACT = "http://localhost:4173/react/";

const run = (
  finalUrl: string,
  scores: Readonly<Record<string, number | null>>,
): LighthouseRun => ({
  finalUrl,
  categories: Object.fromEntries(
    Object.entries(scores).map(([id, score]) => [
      id,
      { title: id === "seo" ? "SEO" : "Performance", score },
    ]),
  ),
});

const passingResults = {
  runs: [run(VANILLA, { performance: 0.98, seo: 1 })],
  failedAssertions: [],
  links: { [VANILLA]: "https://storage.example/report.html" },
  budgetCount: 7,
};

describe("the Lighthouse job summary", () => {
  it("shows each category's score per URL with a link to its report", () => {
    const summary = renderLighthouseSummary(passingResults);

    expect(summary).toContain("| URL | Performance | SEO | Report |");
    expect(summary).toContain(
      "| /vanilla/ | 98 | 100 | [report](https://storage.example/report.html) |",
    );
  });

  it("shows the median score of the runs for a URL", () => {
    const summary = renderLighthouseSummary({
      ...passingResults,
      runs: [
        run(VANILLA, { performance: 0.7, seo: 1 }),
        run(VANILLA, { performance: 0.99, seo: 1 }),
        run(VANILLA, { performance: 0.9, seo: 1 }),
      ],
    });

    expect(summary).toContain("Median score of 3 runs per URL.");
    expect(summary).toContain("| /vanilla/ | 90 | 100 |");
  });

  it("gives every URL its own row", () => {
    const summary = renderLighthouseSummary({
      ...passingResults,
      runs: [
        run(VANILLA, { performance: 1, seo: 1 }),
        run(REACT, { performance: 0.8, seo: 1 }),
      ],
    });

    expect(summary).toContain("| /vanilla/ | 100 | 100 |");
    expect(summary).toContain("| /react/ | 80 | 100 | – |");
  });

  it("shows a dash for a category Lighthouse couldn't score", () => {
    const summary = renderLighthouseSummary({
      ...passingResults,
      runs: [run(VANILLA, { performance: null, seo: 1 })],
    });

    expect(summary).toContain("| /vanilla/ | – | 100 |");
  });

  it("says every budget passes when none failed", () => {
    expect(renderLighthouseSummary(passingResults)).toContain(
      "All 7 budget assertions pass.",
    );
  });

  it("lists every failed budget with its expected and actual value", () => {
    const summary = renderLighthouseSummary({
      ...passingResults,
      failedAssertions: [
        {
          url: VANILLA,
          auditId: "largest-contentful-paint",
          name: "maxNumericValue",
          level: "error",
          operator: "<=",
          expected: 2500,
          actual: 3120.5,
        },
      ],
    });

    expect(summary).toContain("1 of 7 budget assertions fail:");
    expect(summary).toContain(
      "| /vanilla/ | largest-contentful-paint (maxNumericValue) | &lt;= 2500 | 3120.5 | error |",
    );
  });

  it("doesn't claim the budgets pass when they were never checked", () => {
    const summary = renderLighthouseSummary({
      ...passingResults,
      failedAssertions: undefined,
    });

    expect(summary).toContain("The budget assertions didn't run.");
    expect(summary).not.toContain("pass.");
  });

  it("ends with a blank line so the next summary on the page starts its own block", () => {
    expect(renderLighthouseSummary(passingResults).endsWith("\n\n")).toBe(true);
  });
});
