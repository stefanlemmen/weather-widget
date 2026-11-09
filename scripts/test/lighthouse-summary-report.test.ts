import { describe, expect, it } from "vitest";
import {
  budgetCountOf,
  isLighthouseRunFile,
  renderLighthouseSummary,
  type LighthouseRun,
} from "../lighthouse-summary-report.ts";

const VANILLA = "http://localhost:4173/vanilla/";
const REACT = "http://localhost:4173/react/";
const LANDING_PAGE = "http://localhost:4173/";

const run = (
  finalUrl: string,
  scores: Readonly<Record<string, number | null>>,
  audits: LighthouseRun["audits"] = {},
): LighthouseRun => ({
  finalUrl,
  categories: Object.fromEntries(
    Object.entries(scores).map(([id, score]) => [
      id,
      { title: id === "seo" ? "SEO" : "Performance", score },
    ]),
  ),
  audits,
});

const measured = ({
  lcp,
  cls,
  tbt,
  fcp,
  speedIndex,
  scriptBytes,
  totalBytes,
}: Readonly<Record<string, number>>): LighthouseRun["audits"] => ({
  "largest-contentful-paint": { numericValue: lcp },
  "cumulative-layout-shift": { numericValue: cls },
  "total-blocking-time": { numericValue: tbt },
  "first-contentful-paint": { numericValue: fcp },
  "speed-index": { numericValue: speedIndex },
  "resource-summary": {
    details: {
      items: [
        { resourceType: "total", transferSize: totalBytes ?? 0 },
        { resourceType: "script", transferSize: scriptBytes ?? 0 },
      ],
    },
  },
});

const passingResults = {
  runs: [run(VANILLA, { performance: 0.98, seo: 1 })],
  failedAssertions: [],
  links: { [VANILLA]: "https://storage.example/report.html" },
  budgetCount: 7,
  sourceUrl: undefined,
};

const SOURCE_URL = "https://github.com/owner/repo/blob/4106403";

describe("the Lighthouse job summary", () => {
  it("shows each category's score per URL with a link to its report", () => {
    const summary = renderLighthouseSummary(passingResults);

    expect(summary).toContain("| URL | Performance | SEO | Report |");
    expect(summary).toContain(
      "| /vanilla/ | 98 | 100 | [report](https://storage.example/report.html) |",
    );
  });

  it("links each URL to the source of its Example host page", () => {
    expect(
      renderLighthouseSummary({ ...passingResults, sourceUrl: SOURCE_URL }),
    ).toContain(
      `| [/vanilla/](${SOURCE_URL}/hosts/vanilla/index.html) | 98 | 100 |`,
    );
  });

  it("links the landing page to its own source", () => {
    expect(
      renderLighthouseSummary({
        ...passingResults,
        runs: [run(LANDING_PAGE, { performance: 1, seo: 1 })],
        sourceUrl: SOURCE_URL,
      }),
    ).toContain(
      `| [/](${SOURCE_URL}/packages/landing-page/index.html) | 100 | 100 |`,
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

    expect(summary).toContain("Median of 3 runs per URL.");
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

  it("shows the metrics behind the Performance score and the page weight per URL", () => {
    const summary = renderLighthouseSummary({
      ...passingResults,
      runs: [
        run(
          VANILLA,
          { performance: 1 },
          measured({
            lcp: 609.5888,
            cls: 0.0421,
            tbt: 12.4,
            fcp: 512,
            speedIndex: 1480,
            scriptBytes: 23_453,
            totalBytes: 25_171,
          }),
        ),
      ],
    });

    expect(summary).toContain(
      "| URL | LCP | CLS | TBT | FCP | Speed Index | Script size | Total size |",
    );
    expect(summary).toContain(
      "| /vanilla/ | 0.6 s | 0.042 | 12 ms | 0.5 s | 1.5 s | 22.9 KiB | 24.6 KiB |",
    );
  });

  it("shows the median of each metric across the runs for a URL", () => {
    const summary = renderLighthouseSummary({
      ...passingResults,
      runs: [3000, 1200, 2000].map((lcp) =>
        run(VANILLA, { performance: 1 }, measured({ lcp })),
      ),
    });

    expect(summary).toMatch(/\| \/vanilla\/ \| 2 s \|/);
  });

  it("shows a dash for a metric Lighthouse couldn't measure", () => {
    const summary = renderLighthouseSummary({
      ...passingResults,
      runs: [run(VANILLA, { performance: 1 })],
    });

    expect(summary).toContain("| /vanilla/ | – | – | – | – | – | – | – |");
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

  it("links the URL of each failed budget to the source of its page", () => {
    const summary = renderLighthouseSummary({
      ...passingResults,
      sourceUrl: SOURCE_URL,
      failedAssertions: [
        {
          url: REACT,
          name: "maxNumericValue",
          level: "warn",
          operator: "<=",
          expected: 1,
          actual: 2,
        },
      ],
    });

    expect(summary).toContain(
      `| [/react/](${SOURCE_URL}/hosts/react/index.html) | maxNumericValue |`,
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

describe("a Lighthouse run file in .lighthouseci/", () => {
  it.each(["lhr-1762592000000.json", "lhr-1762592000000-123456.json"])(
    "is recognised by the name %s",
    (name) => {
      expect(isLighthouseRunFile(name)).toBe(true);
    },
  );

  it.each([
    "lhr-1762592000000.html",
    "lhr-1762592000000-123456.html",
    "assertion-results.json",
    "links.json",
  ])("isn't confused with %s", (name) => {
    expect(isLighthouseRunFile(name)).toBe(false);
  });
});

describe("the budget count of a Lighthouse config", () => {
  it("counts each assertion once for every URL its pattern matches", () => {
    const config = {
      ci: {
        collect: { url: [VANILLA, REACT] },
        assert: {
          assertMatrix: [
            {
              matchingUrlPattern: ".*",
              assertions: { "categories:seo": "error", lcp: "error" },
            },
            {
              matchingUrlPattern: "/vanilla/$",
              assertions: { "resource-summary:script:size": "error" },
            },
            {
              matchingUrlPattern: "/react/$",
              assertions: { "resource-summary:script:size": "error" },
            },
          ],
        },
      },
    };

    expect(budgetCountOf(config)).toBe(6);
  });

  it("counts nothing for a URL no pattern matches", () => {
    const config = {
      ci: {
        collect: { url: ["http://localhost:4173/angular/"] },
        assert: {
          assertMatrix: [
            {
              matchingUrlPattern: "/react/$",
              assertions: { "categories:seo": "error" },
            },
          ],
        },
      },
    };

    expect(budgetCountOf(config)).toBe(0);
  });
});
