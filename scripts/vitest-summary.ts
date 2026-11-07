import { markdownTable } from "./markdown.ts";

export type VitestTestState = "passed" | "failed" | "skipped" | "pending";
export type VitestRunEndReason = "passed" | "failed" | "interrupted";

export interface VitestTestRow {
  readonly file: string;
  readonly name: string;
  readonly state: VitestTestState;
  readonly durationMs: number;
  readonly firstErrorLine: string | undefined;
}

const COUNTED_STATES = ["passed", "failed", "skipped"] as const;

const countOf = (
  rows: readonly VitestTestRow[],
  state: (typeof COUNTED_STATES)[number],
) =>
  rows.filter((row) =>
    state === "skipped"
      ? row.state === "skipped" || row.state === "pending"
      : row.state === state,
  ).length;

const countsLine = (rows: readonly VitestTestRow[]) =>
  COUNTED_STATES.map((state) => ({ state, total: countOf(rows, state) }))
    .filter(({ state, total }) => total > 0 || state === "passed")
    .map(({ state, total }) => `${String(total)} ${state}`)
    .join(", ");

const groupByFile = (rows: readonly VitestTestRow[]) => {
  const groups = new Map<string, VitestTestRow[]>();
  for (const row of rows) {
    groups.set(row.file, [...(groups.get(row.file) ?? []), row]);
  }
  return groups;
};

const totalDuration = (rows: readonly VitestTestRow[]) =>
  rows.reduce((total, row) => total + row.durationMs, 0);

export const renderVitestSummary = (
  title: string,
  rows: readonly VitestTestRow[],
  reason: VitestRunEndReason,
) => {
  const heading = `## ${title} tests (Vitest)`;
  if (rows.length === 0) {
    return [heading, "", `No tests ran (run ${reason}).`, "", ""].join("\n");
  }

  const failures = rows.filter((row) => row.state === "failed");
  return [
    heading,
    "",
    `${countsLine(rows)} of ${String(rows.length)} tests (run ${reason}).`,
    "",
    markdownTable(
      ["File", "Passed", "Failed", "Skipped", "Duration"],
      [...groupByFile(rows)].map(([file, fileRows]) => [
        file,
        ...COUNTED_STATES.map((state) => String(countOf(fileRows, state))),
        `${String(Math.round(totalDuration(fileRows)))} ms`,
      ]),
    ),
    ...(failures.length > 0
      ? [
          "",
          "### Failures",
          "",
          markdownTable(
            ["File", "Test", "Error"],
            failures.map((row) => [
              row.file,
              row.name,
              row.firstErrorLine ?? "",
            ]),
          ),
        ]
      : []),
    "",
    "",
  ].join("\n");
};
