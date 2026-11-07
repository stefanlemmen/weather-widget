const escapeCell = (cell: string) =>
  cell
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "\\|")
    .replaceAll(/\r?\n/g, " ");

const tableRow = (cells: readonly string[]) =>
  `| ${cells.map(escapeCell).join(" | ")} |`;

export const markdownTable = (
  headers: readonly string[],
  rows: readonly (readonly string[])[],
) =>
  [
    tableRow(headers),
    tableRow(headers.map(() => "---")),
    ...rows.map(tableRow),
  ].join("\n");
