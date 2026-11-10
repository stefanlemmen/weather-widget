import { spawn } from "node:child_process";
import { appendFile } from "node:fs/promises";
import {
  renderCheckSummary,
  type CheckResult,
} from "./check-summary-report.ts";

const CHECKS = [
  { name: "Type check", script: "typecheck" },
  { name: "Lint", script: "lint" },
  { name: "Formatting", script: "format:check" },
  { name: "Icon SVGs", script: "icon-svgs:check" },
  { name: "Mermaid diagrams", script: "diagrams:check" },
] as const;

const IN_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === "true";

const logGroup = (marker: string) => {
  if (IN_GITHUB_ACTIONS) console.log(marker);
};

const run = (name: string, script: string) =>
  new Promise<CheckResult>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const child = spawn("pnpm", [script], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const record = (output: NodeJS.WriteStream) => (chunk: Buffer) => {
      output.write(chunk);
      chunks.push(chunk);
    };
    child.stdout.on("data", record(process.stdout));
    child.stderr.on("data", record(process.stderr));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        name,
        command: `pnpm ${script}`,
        passed: code === 0,
        output: Buffer.concat(chunks).toString("utf8"),
      });
    });
  });

const results: CheckResult[] = [];
for (const { name, script } of CHECKS) {
  logGroup(`::group::${name}`);
  results.push(await run(name, script));
  logGroup("::endgroup::");
}

const summary = renderCheckSummary(results);
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  await appendFile(summaryPath, summary);
} else {
  process.stdout.write(summary);
}

if (results.some((result) => !result.passed)) {
  process.exitCode = 1;
}
