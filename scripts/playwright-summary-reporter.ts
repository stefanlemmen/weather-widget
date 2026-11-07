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
  type TestResult,
} from "./test-summary.ts";

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
      renderTestSummary(
        HEADING,
        this.#suite?.allTests().map(toRow) ?? [],
        result.status,
      ),
    );
  }

  printsToStdio() {
    return false;
  }
}
