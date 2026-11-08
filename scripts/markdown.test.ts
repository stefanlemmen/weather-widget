import { describe, expect, it } from "vitest";
import { markdownTable } from "./markdown.ts";

describe("a markdown table", () => {
  it("renders a header, a separator and one line per row", () => {
    expect(markdownTable(["A", "B"], [["1", "2"]])).toBe(
      "| A | B |\n| --- | --- |\n| 1 | 2 |",
    );
  });

  it("keeps pipes, line breaks and HTML in a cell from breaking the table", () => {
    expect(
      markdownTable(["Error"], [["a | b\r\nwaiting for <button> & co"]]),
    ).toBe(
      "| Error |\n| --- |\n| a \\| b waiting for &lt;button&gt; &amp; co |",
    );
  });
});
