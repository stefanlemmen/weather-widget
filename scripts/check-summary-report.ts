import { stripVTControlCharacters } from "node:util";
import { markdownTable } from "./markdown.ts";

export interface CheckResult {
  readonly name: string;
  readonly command: string;
  readonly passed: boolean;
  readonly output: string;
}

const MAX_ERROR_LINES = 40;
const MIN_FENCE_LENGTH = 3;

const lastLinesOf = (output: string) =>
  stripVTControlCharacters(output)
    .trim()
    .split(/\r?\n/)
    .slice(-MAX_ERROR_LINES)
    .join("\n");

const codeBlock = (text: string) => {
  const longestBacktickRun = Math.max(
    0,
    ...[...text.matchAll(/`+/g)].map(([run]) => run.length),
  );
  const fence = "`".repeat(Math.max(MIN_FENCE_LENGTH, longestBacktickRun + 1));
  return [fence, text, fence].join("\n");
};

const errorsSection = (check: CheckResult) => [
  "",
  `### ${check.name} errors`,
  "",
  codeBlock(lastLinesOf(check.output)),
];

export const renderCheckSummary = (checks: readonly CheckResult[]) => {
  const passing = checks.filter((check) => check.passed).length;
  return [
    "## Checks",
    "",
    `${String(passing)} of ${String(checks.length)} checks pass.`,
    "",
    markdownTable(
      ["Check", "Command", "Result"],
      checks.map((check) => [
        check.name,
        `\`${check.command}\``,
        check.passed ? "✅ passed" : "❌ failed",
      ]),
    ),
    ...checks.filter((check) => !check.passed).flatMap(errorsSection),
    "",
    "",
  ].join("\n");
};
