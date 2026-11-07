import { appendFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";
import type {
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from "@playwright/test/reporter";
import { markdownTable } from "../scripts/markdown.ts";

const OUTCOME_LABELS: Readonly<
  Record<ReturnType<TestCase["outcome"]>, string>
> = {
  expected: "✅ passed",
  unexpected: "❌ failed",
  flaky: "⚠️ flaky",
  skipped: "⏭️ skipped",
};

const firstErrorLine = (test: TestCase) =>
  test.results
    .at(-1)
    ?.error?.message?.split("\n")
    .map(stripVTControlCharacters)
    .find((line) => line.trim() !== "")
    ?.trim() ?? "";

const titleOf = (test: TestCase) =>
  test.titlePath().filter(Boolean).slice(1).join(" › ");

export const renderPlaywrightSummary = (
  tests: readonly TestCase[],
  status: FullResult["status"],
) => {
  const failed = tests.filter((test) => test.outcome() === "unexpected");
  const rows = tests.map((test) => [
    titleOf(test),
    OUTCOME_LABELS[test.outcome()],
    `${String(Math.round(test.results.at(-1)?.duration ?? 0))} ms`,
  ]);
  const failures = failed.map((test) => [titleOf(test), firstErrorLine(test)]);

  return [
    "## End-to-end tests (Playwright)",
    "",
    `${String(tests.length - failed.length)} of ${String(tests.length)} tests passed (run ${status}).`,
    "",
    markdownTable(["Test", "Result", "Duration"], rows),
    ...(failures.length > 0
      ? ["", "### Failures", "", markdownTable(["Test", "Error"], failures)]
      : []),
    "",
  ].join("\n");
};

export default class SummaryReporter implements Reporter {
  #suite: Suite | undefined;

  onBegin(_config: unknown, suite: Suite) {
    this.#suite = suite;
  }

  async onEnd(result: FullResult) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath || !this.#suite) return;
    await appendFile(
      summaryPath,
      renderPlaywrightSummary(this.#suite.allTests(), result.status),
    );
  }

  printsToStdio() {
    return false;
  }
}
