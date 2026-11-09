import * as v from "valibot";
import { markdownTable } from "./markdown.ts";

const NumericAuditSchema = v.optional(
  v.object({ numericValue: v.optional(v.number()) }),
);

export const LighthouseRunSchema = v.object({
  finalUrl: v.string(),
  categories: v.record(
    v.string(),
    v.object({ title: v.string(), score: v.nullable(v.number()) }),
  ),
  audits: v.object({
    "largest-contentful-paint": NumericAuditSchema,
    "cumulative-layout-shift": NumericAuditSchema,
    "total-blocking-time": NumericAuditSchema,
    "first-contentful-paint": NumericAuditSchema,
    "speed-index": NumericAuditSchema,
    "resource-summary": v.optional(
      v.object({
        details: v.optional(
          v.object({
            items: v.array(
              v.object({ resourceType: v.string(), transferSize: v.number() }),
            ),
          }),
        ),
      }),
    ),
  }),
});

export type LighthouseRun = v.InferOutput<typeof LighthouseRunSchema>;

export const FailedAssertionsSchema = v.array(
  v.object({
    url: v.string(),
    auditId: v.optional(v.string()),
    name: v.string(),
    level: v.string(),
    operator: v.string(),
    expected: v.number(),
    actual: v.number(),
  }),
);

export const LighthouseConfigSchema = v.object({
  ci: v.object({
    collect: v.object({ url: v.array(v.string()) }),
    assert: v.object({
      assertMatrix: v.array(
        v.object({
          matchingUrlPattern: v.string(),
          assertions: v.record(v.string(), v.unknown()),
        }),
      ),
    }),
  }),
});

export const budgetCountOf = ({
  ci: { collect, assert },
}: v.InferOutput<typeof LighthouseConfigSchema>) =>
  collect.url
    .flatMap((url) =>
      assert.assertMatrix.filter(({ matchingUrlPattern }) =>
        new RegExp(matchingUrlPattern).test(url),
      ),
    )
    .reduce(
      (count, { assertions }) => count + Object.keys(assertions).length,
      0,
    );

export const ReportLinksSchema = v.record(v.string(), v.string());

export interface LighthouseResults {
  readonly runs: readonly LighthouseRun[];
  readonly failedAssertions:
    v.InferOutput<typeof FailedAssertionsSchema> | undefined;
  readonly links: v.InferOutput<typeof ReportLinksSchema>;
  readonly budgetCount: number;
  readonly sourceUrl: string | undefined;
}

const NO_VALUE = "–";

const groupByUrl = (runs: readonly LighthouseRun[]) => {
  const groups = new Map<string, LighthouseRun[]>();
  for (const run of runs) {
    groups.set(run.finalUrl, [...(groups.get(run.finalUrl) ?? []), run]);
  }
  return groups;
};

const median = (values: readonly number[]) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];

type NumericAuditId = Exclude<
  keyof LighthouseRun["audits"],
  "resource-summary"
>;

const BYTES_PER_KIBIBYTE = 1024;
const MILLISECONDS_PER_SECOND = 1000;

const formatNumber = (value: number, maximumFractionDigits: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits }).format(value);

const seconds = (milliseconds: number) =>
  `${formatNumber(milliseconds / MILLISECONDS_PER_SECOND, 1)} s`;
const milliseconds = (value: number) => `${formatNumber(value, 0)} ms`;
const unitless = (value: number) => formatNumber(value, 3);
const kibibytes = (bytes: number) =>
  `${formatNumber(bytes / BYTES_PER_KIBIBYTE, 1)} KiB`;

const numericValueOf = (id: NumericAuditId) => (run: LighthouseRun) =>
  run.audits[id]?.numericValue;

const transferSizeOf = (resourceType: string) => (run: LighthouseRun) =>
  run.audits["resource-summary"]?.details?.items.find(
    (item) => item.resourceType === resourceType,
  )?.transferSize;

const METRICS: readonly {
  readonly title: string;
  readonly valueOf: (run: LighthouseRun) => number | undefined;
  readonly format: (value: number) => string;
}[] = [
  {
    title: "LCP",
    valueOf: numericValueOf("largest-contentful-paint"),
    format: seconds,
  },
  {
    title: "CLS",
    valueOf: numericValueOf("cumulative-layout-shift"),
    format: unitless,
  },
  {
    title: "TBT",
    valueOf: numericValueOf("total-blocking-time"),
    format: milliseconds,
  },
  {
    title: "FCP",
    valueOf: numericValueOf("first-contentful-paint"),
    format: seconds,
  },
  {
    title: "Speed Index",
    valueOf: numericValueOf("speed-index"),
    format: seconds,
  },
  {
    title: "Script size",
    valueOf: transferSizeOf("script"),
    format: kibibytes,
  },
  { title: "Total size", valueOf: transferSizeOf("total"), format: kibibytes },
];

const metricCell = (
  runs: readonly LighthouseRun[],
  metric: (typeof METRICS)[number],
) => {
  const values = runs
    .map(metric.valueOf)
    .filter((value) => value !== undefined);
  const value = median(values);
  return value === undefined ? NO_VALUE : metric.format(value);
};

const RUN_FILE_PATTERN = /^lhr-\d+(-\d+)?\.json$/;

export const isLighthouseRunFile = (name: string) =>
  RUN_FILE_PATTERN.test(name);

const pathOf = (url: string) => new URL(url).pathname;

const EXAMPLE_HOSTS_DIRECTORY = "hosts";
const EXAMPLE_HOST_PAGE = "index.html";

const urlCell = (url: string, sourceUrl: string | undefined) => {
  const path = pathOf(url);
  return sourceUrl
    ? `[${path}](${sourceUrl}/${EXAMPLE_HOSTS_DIRECTORY}${path}${EXAMPLE_HOST_PAGE})`
    : path;
};

const scoreCell = (runs: readonly LighthouseRun[], category: string) => {
  const score = median(
    runs
      .map((run) => run.categories[category]?.score)
      .filter((value) => typeof value === "number"),
  );
  return score === undefined ? NO_VALUE : String(Math.round(score * 100));
};

const budgetLines = ({
  failedAssertions,
  budgetCount,
  sourceUrl,
}: LighthouseResults) => {
  if (failedAssertions === undefined) {
    return ["The budget assertions didn't run."];
  }
  if (failedAssertions.length === 0) {
    return [`All ${String(budgetCount)} budget assertions pass.`];
  }
  return [
    `${String(failedAssertions.length)} of ${String(budgetCount)} budget assertions fail:`,
    "",
    markdownTable(
      ["URL", "Assertion", "Expected", "Actual", "Level"],
      failedAssertions.map((assertion) => [
        urlCell(assertion.url, sourceUrl),
        assertion.auditId
          ? `${assertion.auditId} (${assertion.name})`
          : assertion.name,
        `${assertion.operator} ${String(assertion.expected)}`,
        String(assertion.actual),
        assertion.level,
      ]),
    ),
  ];
};

export const renderLighthouseSummary = (results: LighthouseResults) => {
  const runsByUrl = groupByUrl(results.runs);
  const categories = Object.entries(results.runs[0]?.categories ?? {});
  const runsPerUrl = Math.max(
    ...[...runsByUrl.values()].map((runs) => runs.length),
  );

  return [
    "## Lighthouse",
    "",
    `Median of ${String(runsPerUrl)} runs per URL.`,
    "",
    markdownTable(
      ["URL", ...categories.map(([, category]) => category.title), "Report"],
      [...runsByUrl].map(([url, runs]) => {
        const report = results.links[url];
        return [
          urlCell(url, results.sourceUrl),
          ...categories.map(([id]) => scoreCell(runs, id)),
          report ? `[report](${report})` : NO_VALUE,
        ];
      }),
    ),
    "",
    markdownTable(
      ["URL", ...METRICS.map((metric) => metric.title)],
      [...runsByUrl].map(([url, runs]) => [
        urlCell(url, results.sourceUrl),
        ...METRICS.map((metric) => metricCell(runs, metric)),
      ]),
    ),
    "",
    ...budgetLines(results),
    "",
    "",
  ].join("\n");
};
