import type { FullResult, TestCase } from "@playwright/test/reporter";
import { markdownTable } from "../scripts/markdown.ts";

type Outcome = ReturnType<TestCase["outcome"]>;

export interface PlaywrightTestRow {
  readonly title: string;
  readonly outcome: Outcome;
  readonly durationMs: number;
  readonly firstErrorLine: string | undefined;
}

const OUTCOMES: readonly { outcome: Outcome; count: string; label: string }[] =
  [
    { outcome: "expected", count: "passed", label: "✅ passed" },
    { outcome: "unexpected", count: "failed", label: "❌ failed" },
    { outcome: "flaky", count: "flaky", label: "⚠️ flaky" },
    { outcome: "skipped", count: "skipped", label: "⏭️ skipped" },
  ];

const labelOf = (outcome: Outcome) =>
  OUTCOMES.find((entry) => entry.outcome === outcome)?.label ?? outcome;

const countsLine = (rows: readonly PlaywrightTestRow[]) =>
  OUTCOMES.map(({ outcome, count }) => ({
    count,
    total: rows.filter((row) => row.outcome === outcome).length,
  }))
    .filter(({ count, total }) => total > 0 || count === "passed")
    .map(({ count, total }) => `${String(total)} ${count}`)
    .join(", ");

export const renderPlaywrightSummary = (
  rows: readonly PlaywrightTestRow[],
  status: FullResult["status"],
) => {
  const heading = "## End-to-end tests (Playwright)";
  if (rows.length === 0) {
    return [heading, "", `No tests ran (run ${status}).`, ""].join("\n");
  }

  const failures = rows.filter((row) => row.outcome === "unexpected");
  return [
    heading,
    "",
    `${countsLine(rows)} of ${String(rows.length)} tests (run ${status}).`,
    "",
    markdownTable(
      ["Test", "Result", "Duration"],
      rows.map((row) => [
        row.title,
        labelOf(row.outcome),
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
  ].join("\n");
};
