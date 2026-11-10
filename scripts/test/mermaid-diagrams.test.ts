import { describe, expect, it } from "vitest";
import { mermaidDiagrams } from "../mermaid-diagrams.ts";

describe("the Mermaid diagrams in a markdown file", () => {
  it("finds each diagram with the line its fence opens on", () => {
    const markdown = [
      "# Title",
      "",
      "```mermaid",
      "flowchart TD",
      "    A --> B",
      "```",
      "",
      "```mermaid",
      "stateDiagram-v2",
      "```",
    ].join("\n");

    expect(mermaidDiagrams(markdown)).toEqual([
      { line: 3, source: "flowchart TD\n    A --> B" },
      { line: 8, source: "stateDiagram-v2" },
    ]);
  });

  it("skips code blocks in other languages", () => {
    const markdown = ["```sh", "pnpm dev", "```"].join("\n");

    expect(mermaidDiagrams(markdown)).toEqual([]);
  });

  it("takes the rest of the file when the fence never closes", () => {
    const markdown = ["```mermaid", "flowchart TD", "    A --> B"].join("\n");

    expect(mermaidDiagrams(markdown)).toEqual([
      { line: 1, source: "flowchart TD\n    A --> B" },
    ]);
  });

  it("reads files with Windows line endings", () => {
    const markdown = ["```mermaid", "flowchart TD", "```"].join("\r\n");

    expect(mermaidDiagrams(markdown)).toEqual([
      { line: 1, source: "flowchart TD" },
    ]);
  });
});
