import { appendFile } from "node:fs/promises";
import { stripVTControlCharacters } from "node:util";
import type { InlineConfig, Reporter, TestCase, TestModule } from "vitest/node";
import {
  renderVitestSummary,
  type VitestRunEndReason,
  type VitestTestRow,
} from "./vitest-summary.ts";

const toRow = (test: TestCase): VitestTestRow => {
  const result = test.result();
  return {
    file: test.module.relativeModuleId,
    name: test.fullName.replaceAll(" > ", " › "),
    state: result.state,
    durationMs: test.diagnostic()?.duration ?? 0,
    firstErrorLine: result.errors?.[0]?.message
      .split("\n")
      .map(stripVTControlCharacters)
      .map((line) => line.trim())
      .find((line) => line !== ""),
  };
};

class VitestSummaryReporter implements Reporter {
  readonly #title: string;

  constructor(title: string) {
    this.#title = title;
  }

  async onTestRunEnd(
    testModules: readonly TestModule[],
    _unhandledErrors: unknown,
    reason: VitestRunEndReason,
  ) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;
    const rows = testModules.flatMap((module) =>
      [...module.children.allTests()].map(toRow),
    );
    await appendFile(
      summaryPath,
      renderVitestSummary(this.#title, rows, reason),
    );
  }
}

export const vitestCiReporting = (
  title: string,
): Pick<InlineConfig, "reporters"> =>
  process.env.GITHUB_ACTIONS === "true"
    ? {
        reporters: [
          "default",
          ["github-actions", { jobSummary: { enabled: false } }],
          new VitestSummaryReporter(title),
        ],
      }
    : {};
