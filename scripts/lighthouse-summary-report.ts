import * as v from "valibot";
import { markdownTable } from "./markdown.ts";

export const LighthouseRunSchema = v.object({
  finalUrl: v.string(),
  categories: v.record(
    v.string(),
    v.object({ title: v.string(), score: v.nullable(v.number()) }),
  ),
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

export const ReportLinksSchema = v.record(v.string(), v.string());

export interface LighthouseResults {
  readonly runs: readonly LighthouseRun[];
  readonly failedAssertions:
    v.InferOutput<typeof FailedAssertionsSchema> | undefined;
  readonly links: v.InferOutput<typeof ReportLinksSchema>;
  readonly budgetCount: number;
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

const pathOf = (url: string) => new URL(url).pathname;

const scoreCell = (runs: readonly LighthouseRun[], category: string) => {
  const score = median(
    runs
      .map((run) => run.categories[category]?.score)
      .filter((value) => typeof value === "number"),
  );
  return score === undefined ? NO_VALUE : String(Math.round(score * 100));
};

const budgetLines = ({ failedAssertions, budgetCount }: LighthouseResults) => {
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
        pathOf(assertion.url),
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
    `Median score of ${String(runsPerUrl)} runs per URL.`,
    "",
    markdownTable(
      ["URL", ...categories.map(([, category]) => category.title), "Report"],
      [...runsByUrl].map(([url, runs]) => {
        const report = results.links[url];
        return [
          pathOf(url),
          ...categories.map(([id]) => scoreCell(runs, id)),
          report ? `[report](${report})` : NO_VALUE,
        ];
      }),
    ),
    "",
    ...budgetLines(results),
    "",
    "",
  ].join("\n");
};
