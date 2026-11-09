import { appendFile, readdir, readFile } from "node:fs/promises";
import * as v from "valibot";
import {
  budgetCountOf,
  isLighthouseRunFile,
  FailedAssertionsSchema,
  LighthouseConfigSchema,
  LighthouseRunSchema,
  renderLighthouseSummary,
  ReportLinksSchema,
} from "./lighthouse-summary-report.ts";
import { sourceUrlFrom } from "./source-link.ts";

const LHCI_DIRECTORY = new URL("../.lighthouseci/", import.meta.url);
const LIGHTHOUSE_CONFIG = new URL("../lighthouserc.json", import.meta.url);
const ASSERTION_RESULTS_FILE = "assertion-results.json";
const LINKS_FILE = "links.json";

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

const runFiles = (await readdir(LHCI_DIRECTORY)).filter(isLighthouseRunFile);
if (runFiles.length === 0) {
  throw new Error(
    "No Lighthouse runs found in .lighthouseci/. Run pnpm lighthouse first.",
  );
}

const config = await readJson(LighthouseConfigSchema, LIGHTHOUSE_CONFIG);
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
  budgetCount: budgetCountOf(config),
  sourceUrl: sourceUrlFrom(process.env),
});

const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  await appendFile(summaryPath, summary);
} else {
  process.stdout.write(summary);
}
