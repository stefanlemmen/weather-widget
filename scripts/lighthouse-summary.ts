import { appendFile, readdir, readFile } from "node:fs/promises";
import * as v from "valibot";
import { markdownTable } from "./markdown.ts";

const LHCI_DIRECTORY = new URL("../.lighthouseci/", import.meta.url);
const LIGHTHOUSE_CONFIG = new URL("../lighthouserc.json", import.meta.url);
const ASSERTION_RESULTS_FILE = "assertion-results.json";
const LINKS_FILE = "links.json";
const RUN_FILE_PATTERN = /^lhr-\d+\.json$/;

const RunSchema = v.object({
  finalDisplayedUrl: v.string(),
  categories: v.record(
    v.string(),
    v.object({ title: v.string(), score: v.nullable(v.number()) }),
  ),
});

type Run = v.InferOutput<typeof RunSchema>;

const FailedAssertionsSchema = v.array(
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

const LinksSchema = v.record(v.string(), v.string());

const ConfigSchema = v.object({
  ci: v.object({
    collect: v.object({ url: v.array(v.string()) }),
    assert: v.object({ assertions: v.record(v.string(), v.unknown()) }),
  }),
});

const readJson = async <TSchema extends v.GenericSchema>(
  schema: TSchema,
  url: URL,
): Promise<v.InferOutput<TSchema>> =>
  v.parse(schema, JSON.parse(await readFile(url, "utf8")));

const readOptionalJson = async <TSchema extends v.GenericSchema>(
  schema: TSchema,
  url: URL,
  fallback: v.InferOutput<TSchema>,
): Promise<v.InferOutput<TSchema>> => {
  try {
    return await readJson(schema, url);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
};

const median = (values: readonly number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

const groupByUrl = (runs: readonly Run[]) => {
  const groups = new Map<string, Run[]>();
  for (const run of runs) {
    groups.set(run.finalDisplayedUrl, [
      ...(groups.get(run.finalDisplayedUrl) ?? []),
      run,
    ]);
  }
  return groups;
};

const pathOf = (url: string) => new URL(url).pathname;

const scoreCell = (runs: readonly Run[], category: string) => {
  const scores = runs
    .map((run) => run.categories[category]?.score)
    .filter((score) => typeof score === "number");
  const score = median(scores);
  return score === undefined ? "–" : String(Math.round(score * 100));
};

const renderLighthouseSummary = (input: {
  readonly runs: readonly Run[];
  readonly failedAssertions: v.InferOutput<typeof FailedAssertionsSchema>;
  readonly links: v.InferOutput<typeof LinksSchema>;
  readonly budgetCount: number;
}) => {
  const runsByUrl = groupByUrl(input.runs);
  const categories = Object.entries(input.runs[0]?.categories ?? {});
  const rows = [...runsByUrl].map(([url, runs]) => [
    pathOf(url),
    ...categories.map(([id]) => scoreCell(runs, id)),
    input.links[url] ? `[report](${input.links[url]})` : "–",
  ]);
  const failures = input.failedAssertions.map((assertion) => [
    pathOf(assertion.url),
    assertion.auditId
      ? `${assertion.auditId} (${assertion.name})`
      : assertion.name,
    `${assertion.operator} ${String(assertion.expected)}`,
    String(assertion.actual),
    assertion.level,
  ]);
  const runsPerUrl = Math.max(...[...runsByUrl.values()].map((r) => r.length));

  return [
    "## Lighthouse",
    "",
    `Median score of ${String(runsPerUrl)} runs per URL.`,
    "",
    markdownTable(
      ["URL", ...categories.map(([, category]) => category.title), "Report"],
      rows,
    ),
    "",
    failures.length === 0
      ? `All ${String(input.budgetCount)} budget assertions pass.`
      : [
          `${String(failures.length)} of ${String(input.budgetCount)} budget assertions fail:`,
          "",
          markdownTable(
            ["URL", "Assertion", "Expected", "Actual", "Level"],
            failures,
          ),
        ].join("\n"),
    "",
  ].join("\n");
};

const runFiles = (await readdir(LHCI_DIRECTORY)).filter((file) =>
  RUN_FILE_PATTERN.test(file),
);
const runs = await Promise.all(
  runFiles.map((file) => readJson(RunSchema, new URL(file, LHCI_DIRECTORY))),
);
if (runs.length === 0) {
  throw new Error(
    "No Lighthouse runs found in .lighthouseci/. Run pnpm lighthouse first.",
  );
}
const config = await readJson(ConfigSchema, LIGHTHOUSE_CONFIG);
const summary = renderLighthouseSummary({
  runs,
  failedAssertions: await readOptionalJson(
    FailedAssertionsSchema,
    new URL(ASSERTION_RESULTS_FILE, LHCI_DIRECTORY),
    [],
  ),
  links: await readOptionalJson(
    LinksSchema,
    new URL(LINKS_FILE, LHCI_DIRECTORY),
    {},
  ),
  budgetCount:
    Object.keys(config.ci.assert.assertions).length *
    config.ci.collect.url.length,
});

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  await appendFile(summaryPath, summary);
} else {
  process.stdout.write(summary);
}
