import { appendFile } from "node:fs/promises";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from "@playwright/test/reporter";
import {
  firstLineOf,
  renderTestSummary,
  repositoryPathOf,
  type TestResult,
} from "./test-summary.ts";
import { sourceUrlFrom } from "./source-link.ts";

const HEADING = "## End-to-end tests (Playwright)";

const RESULT_OF: Readonly<Record<ReturnType<TestCase["outcome"]>, TestResult>> =
  {
    expected: "passed",
    unexpected: "failed",
    flaky: "flaky",
    skipped: "skipped",
  };

const toRow = (test: TestCase) => {
  const lastAttempt = test.results.at(-1);
  return {
    file: repositoryPathOf(test.location.file),
    line: test.location.line,
    title: test.titlePath().slice(3).join(" › "),
    result: RESULT_OF[test.outcome()],
    durationMs: lastAttempt?.duration ?? 0,
    firstErrorLine: firstLineOf(lastAttempt?.error?.message),
  };
};

export default class SummaryReporter implements Reporter {
  #suite: Suite | undefined;

  onBegin(_config: FullConfig, suite: Suite) {
    this.#suite = suite;
  }

  async onEnd(result: FullResult) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;
    await appendFile(
      summaryPath,
      renderTestSummary({
        heading: HEADING,
        rows: this.#suite?.allTests().map(toRow) ?? [],
        status: result.status,
        sourceUrl: sourceUrlFrom(process.env),
      }),
    );
  }

  printsToStdio() {
    return false;
  }
}
