import { appendFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from "@playwright/test/reporter";
import {
  renderPlaywrightSummary,
  type PlaywrightTestRow,
} from "./playwright-summary.ts";

const toRow = (test: TestCase): PlaywrightTestRow => {
  const lastAttempt = test.results.at(-1);
  return {
    title: test.titlePath().filter(Boolean).slice(1).join(" › "),
    outcome: test.outcome(),
    durationMs: lastAttempt?.duration ?? 0,
    firstErrorLine: lastAttempt?.error?.message
      ?.split("\n")
      .map(stripVTControlCharacters)
      .map((line) => line.trim())
      .find((line) => line !== ""),
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
      renderPlaywrightSummary(
        this.#suite?.allTests().map(toRow) ?? [],
        result.status,
      ),
    );
  }

  printsToStdio() {
    return false;
  }
}
