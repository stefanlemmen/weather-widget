const LINE_BREAK = /\r?\n/;
const MERMAID_FENCE = "```mermaid";
const CLOSING_FENCE = "```";

export interface MermaidDiagram {
  readonly line: number;
  readonly source: string;
}

export const mermaidDiagrams = (
  markdown: string,
): readonly MermaidDiagram[] => {
  const lines = markdown.split(LINE_BREAK);
  return lines.flatMap((text, index) => {
    if (text.trim() !== MERMAID_FENCE) return [];
    const body = lines.slice(index + 1);
    const closing = body.findIndex((line) => line.trim() === CLOSING_FENCE);
    const diagramLines = closing === -1 ? body : body.slice(0, closing);
    return [{ line: index + 1, source: diagramLines.join("\n") }];
  });
};
