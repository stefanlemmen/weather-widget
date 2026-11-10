import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import type { Mermaid } from "mermaid";
import { mermaidDiagrams } from "./mermaid-diagrams.ts";

declare global {
  var mermaid: Mermaid;
}

type Rendered = { readonly svg: string } | { readonly error: string };

const workspaceRoot = new URL("../", import.meta.url);
const PREVIEW_DIRECTORY_NAME = ".diagrams";
const previewDirectory = new URL(`${PREVIEW_DIRECTORY_NAME}/`, workspaceRoot);
const MERMAID_BUNDLE = fileURLToPath(
  import.meta.resolve("mermaid/dist/mermaid.min.js"),
);
const MARKDOWN_FILES_COMMAND = [
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "--",
  "*.md",
];
const MARKDOWN_EXTENSION = /\.md$/;

const markdownFiles = async () => {
  const { stdout } = await promisify(execFile)("git", MARKDOWN_FILES_COMMAND, {
    cwd: workspaceRoot,
  });
  return stdout.split("\n").filter((file) => file !== "");
};

const previewName = (file: string, number: number) =>
  `${file.replace(MARKDOWN_EXTENSION, "").replaceAll("/", "-")}-${String(number)}.svg`;

const renderInBrowser = async (
  sources: readonly string[],
): Promise<readonly Rendered[]> => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ path: MERMAID_BUNDLE });
    return await page.evaluate(async (diagrams) => {
      globalThis.mermaid.initialize({ startOnLoad: false });
      const rendered: Rendered[] = [];
      for (const [index, source] of diagrams.entries()) {
        try {
          const { svg } = await globalThis.mermaid.render(
            `diagram-${String(index)}`,
            source,
          );
          rendered.push({ svg });
        } catch (error) {
          rendered.push({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      return rendered;
    }, sources);
  } finally {
    await browser.close();
  }
};

const files = await markdownFiles();
const diagrams = (
  await Promise.all(
    files.map(async (file) =>
      mermaidDiagrams(await readFile(new URL(file, workspaceRoot), "utf8")).map(
        (diagram, index) => ({ ...diagram, file, number: index + 1 }),
      ),
    ),
  )
).flat();
const rendered = await renderInBrowser(
  diagrams.map((diagram) => diagram.source),
);

await rm(previewDirectory, { recursive: true, force: true });
await mkdir(previewDirectory, { recursive: true });

const failures = await Promise.all(
  diagrams.map(async ({ file, line, number }, index) => {
    const result = rendered[index];
    if (result === undefined || "error" in result) {
      console.error(
        `${file}:${String(line)} ${result?.error ?? "not rendered"}`,
      );
      return 1;
    }
    await writeFile(
      new URL(previewName(file, number), previewDirectory),
      result.svg,
    );
    return 0;
  }),
);
const failed = failures.reduce<number>((sum, count) => sum + count, 0);

console.log(
  `${String(diagrams.length - failed)} of ${String(diagrams.length)} Mermaid diagrams rendered to ${PREVIEW_DIRECTORY_NAME}/`,
);
if (failed > 0) process.exitCode = 1;
