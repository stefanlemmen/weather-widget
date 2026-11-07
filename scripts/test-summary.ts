import { stripVTControlCharacters } from "node:util";
import { markdownTable } from "./markdown.ts";

const RESULTS = ["passed", "failed", "flaky", "skipped"] as const;

export type TestResult = (typeof RESULTS)[number];

export interface TestRow {
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

export const renderTestSummary = (
  heading: string,
  rows: readonly TestRow[],
  status: string,
) => {
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
        row.title,
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
            failures.map((row) => [row.title, row.firstErrorLine ?? ""]),
          ),
        ]
      : []),
    "",
    "",
  ].join("\n");
};
