import { appendFile } from "node:fs/promises";
import type {
  InlineConfig,
  Reporter,
  TestCase,
  TestModule,
  TestRunEndReason,
} from "vitest/node";
import {
  firstLineOf,
  renderTestSummary,
  repositoryPathOf,
  sourceUrlFrom,
  type TestResult,
} from "./test-summary.ts";

const RESULT_OF: Readonly<
  Record<ReturnType<TestCase["result"]>["state"], TestResult>
> = {
  passed: "passed",
  failed: "failed",
  skipped: "skipped",
  pending: "skipped",
};

const toRow = (test: TestCase) => {
  const result = test.result();
  return {
    file: repositoryPathOf(test.module.moduleId),
    line: test.location?.line,
    title: test.fullName.replaceAll(" > ", " › "),
    result: RESULT_OF[result.state],
    durationMs: test.diagnostic()?.duration ?? 0,
    firstErrorLine: firstLineOf(result.errors?.[0]?.message),
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
    reason: TestRunEndReason,
  ) {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;
    const rows = testModules.flatMap((module) =>
      [...module.children.allTests()].map(toRow),
    );
    await appendFile(
      summaryPath,
      renderTestSummary({
        heading: `## ${this.#title} tests (Vitest)`,
        rows,
        status: reason,
        sourceUrl: sourceUrlFrom(process.env),
      }),
    );
  }
}

export const vitestCiReporting = (
  title: string,
): Pick<InlineConfig, "reporters" | "includeTaskLocation"> =>
  process.env.GITHUB_ACTIONS === "true"
    ? {
        reporters: [
          "default",
          ["github-actions", { jobSummary: { enabled: false } }],
          new VitestSummaryReporter(title),
        ],
        includeTaskLocation: true,
      }
    : {};
