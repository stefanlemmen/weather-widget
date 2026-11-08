import { describe, expect, it } from "vitest";
import {
  renderCheckSummary,
  type CheckResult,
} from "./check-summary-report.ts";

const result = (overrides: Partial<CheckResult>): CheckResult => ({
  name: "Type check",
  command: "pnpm typecheck",
  passed: true,
  output: "",
  ...overrides,
});

const allPassing = [
  result({}),
  result({ name: "Lint", command: "pnpm lint" }),
  result({ name: "Formatting", command: "pnpm format:check" }),
];

describe("the check job summary", () => {
  it("lists every check with its command and result", () => {
    const summary = renderCheckSummary(allPassing);

    expect(summary).toMatch(/^## Checks\n/);
    expect(summary).toContain("3 of 3 checks pass.");
    expect(summary).toContain("| Check | Command | Result |");
    expect(summary).toContain("| Type check | `pnpm typecheck` | ✅ passed |");
    expect(summary).toContain("| Lint | `pnpm lint` | ✅ passed |");
  });

  it("shows no output when every check passes", () => {
    expect(
      renderCheckSummary([result({ output: "packages/proxy: Done" })]),
    ).not.toContain("Done");
  });

  it("shows the output of each failed check as its errors", () => {
    const summary = renderCheckSummary([
      result({}),
      result({
        name: "Lint",
        command: "pnpm lint",
        passed: false,
        output:
          "\n/repo/scripts/check.ts\n  12:7  error  'unused' is assigned a value but never used\n\n",
      }),
    ]);

    expect(summary).toContain("1 of 2 checks pass.");
    expect(summary).toContain("| Lint | `pnpm lint` | ❌ failed |");
    expect(summary).toContain(
      "### Lint errors\n\n```\n/repo/scripts/check.ts\n  12:7  error  'unused' is assigned a value but never used\n```",
    );
  });

  it("shows only the last 40 lines of a long failure", () => {
    const lines = Array.from(
      { length: 50 },
      (_, index) => `line ${String(index + 1)}`,
    );
    const summary = renderCheckSummary([
      result({ passed: false, output: lines.join("\n") }),
    ]);

    expect(summary).toContain("```\nline 11\n");
    expect(summary).not.toContain("line 10\n");
    expect(summary).toContain("line 50\n```");
  });

  it("strips terminal colours from the output", () => {
    expect(
      renderCheckSummary([
        result({ passed: false, output: "\u001b[31merror TS2322\u001b[39m" }),
      ]),
    ).toContain("```\nerror TS2322\n```");
  });

  it("keeps backticks in the output from closing the code block", () => {
    expect(
      renderCheckSummary([result({ passed: false, output: "Unexpected ```" })]),
    ).toContain("````\nUnexpected ```\n````");
  });

  it("ends with a blank line so the next summary on the page starts its own block", () => {
    expect(renderCheckSummary(allPassing).endsWith("\n\n")).toBe(true);
  });
});
