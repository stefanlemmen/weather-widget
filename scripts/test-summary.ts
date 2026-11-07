import { relative, resolve } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { markdownTable } from "./markdown.ts";

const RESULTS = ["passed", "failed", "flaky", "skipped"] as const;

export type TestResult = (typeof RESULTS)[number];

export interface TestRow {
  readonly file: string;
  readonly title: string;
  readonly result: TestResult;
  readonly durationMs: number;
  readonly firstErrorLine: string | undefined;
}

const RESULT_LABELS: Readonly<Record<TestResult, string>> = {
  passed: "✅ passed",
  failed: "❌ failed",
  flaky: "⚠️ flaky",
  skipped: "⏭️ skipped",
};

const countsLine = (rows: readonly TestRow[]) =>
  RESULTS.map((result) => ({
    result,
    total: rows.filter((row) => row.result === result).length,
  }))
    .filter(({ result, total }) => total > 0 || result === "passed")
    .map(({ result, total }) => `${String(total)} ${result}`)
    .join(", ");

export const firstLineOf = (message: string | undefined) =>
  message
    ?.split("\n")
    .map(stripVTControlCharacters)
    .map((line) => line.trim())
    .find((line) => line !== "");

export interface TestSummary {
  readonly heading: string;
  readonly rows: readonly TestRow[];
  readonly status: string;
  readonly sourceUrl: string | undefined;
}

const REPOSITORY_ROOT = resolve(import.meta.dirname, "..");

export const repositoryPathOf = (absolutePath: string) =>
  relative(REPOSITORY_ROOT, absolutePath);

export const sourceUrlFrom = ({
  GITHUB_SERVER_URL,
  GITHUB_REPOSITORY,
}: Readonly<Record<string, string | undefined>>) =>
  GITHUB_SERVER_URL && GITHUB_REPOSITORY
    ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/blob/main`
    : undefined;

const testCell = (row: TestRow, sourceUrl: string | undefined) =>
  `${sourceUrl ? `[${row.file}](${sourceUrl}/${row.file})` : row.file} > ${row.title}`;

export const renderTestSummary = ({
  heading,
  rows,
  status,
  sourceUrl,
}: TestSummary) => {
  if (rows.length === 0) {
    return [heading, "", `No tests ran (run ${status}).`, "", ""].join("\n");
  }

  const failures = rows.filter((row) => row.result === "failed");
  return [
    heading,
    "",
    `${countsLine(rows)} of ${String(rows.length)} tests (run ${status}).`,
    "",
    markdownTable(
      ["Test", "Result", "Duration"],
      rows.map((row) => [
        testCell(row, sourceUrl),
        RESULT_LABELS[row.result],
        `${String(Math.round(row.durationMs))} ms`,
      ]),
    ),
    ...(failures.length > 0
      ? [
          "",
          "### Failures",
          "",
          markdownTable(
            ["Test", "Error"],
            failures.map((row) => [
              testCell(row, sourceUrl),
              row.firstErrorLine ?? "",
            ]),
          ),
        ]
      : []),
    "",
    "",
  ].join("\n");
};
