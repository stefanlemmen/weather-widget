import { appendFile, readdir, readFile } from "node:fs/promises";
import * as v from "valibot";
import {
  FailedAssertionsSchema,
  LighthouseRunSchema,
  renderLighthouseSummary,
  ReportLinksSchema,
} from "./lighthouse-summary-report.ts";

const LHCI_DIRECTORY = new URL("../.lighthouseci/", import.meta.url);
const LIGHTHOUSE_CONFIG = new URL("../lighthouserc.json", import.meta.url);
const ASSERTION_RESULTS_FILE = "assertion-results.json";
const LINKS_FILE = "links.json";
const RUN_FILE_PATTERN = /^lhr-\d+\.json$/;

const ConfigSchema = v.object({
  ci: v.object({
    collect: v.object({ url: v.array(v.string()) }),
    assert: v.object({ assertions: v.record(v.string(), v.unknown()) }),
  }),
});

const isMissingFile = (error: unknown) =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

const readJson = async <TSchema extends v.GenericSchema>(
  schema: TSchema,
  url: URL,
): Promise<v.InferOutput<TSchema>> =>
  v.parse(schema, JSON.parse(await readFile(url, "utf8")));

const readJsonIfPresent = async <TSchema extends v.GenericSchema>(
  schema: TSchema,
  url: URL,
): Promise<v.InferOutput<TSchema> | undefined> => {
  try {
    return await readJson(schema, url);
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
};

const runFiles = (await readdir(LHCI_DIRECTORY)).filter((file) =>
  RUN_FILE_PATTERN.test(file),
);
if (runFiles.length === 0) {
  throw new Error(
    "No Lighthouse runs found in .lighthouseci/. Run pnpm lighthouse first.",
  );
}

const config = await readJson(ConfigSchema, LIGHTHOUSE_CONFIG);
const summary = renderLighthouseSummary({
  runs: await Promise.all(
    runFiles.map((file) =>
      readJson(LighthouseRunSchema, new URL(file, LHCI_DIRECTORY)),
    ),
  ),
  failedAssertions: await readJsonIfPresent(
    FailedAssertionsSchema,
    new URL(ASSERTION_RESULTS_FILE, LHCI_DIRECTORY),
  ),
  links:
    (await readJsonIfPresent(
      ReportLinksSchema,
      new URL(LINKS_FILE, LHCI_DIRECTORY),
    )) ?? {},
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
