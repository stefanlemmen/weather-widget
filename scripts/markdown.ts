const escapeCell = (cell: string) =>
  cell.replaceAll("|", "\\|").replaceAll("\n", " ");

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
