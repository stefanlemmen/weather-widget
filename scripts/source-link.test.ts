import { describe, expect, it } from "vitest";
import { sourceUrlFrom } from "./source-link.ts";

const SHA = "4106403736223f0c551d8502265696f6d6a31321";
const SOURCE_URL = `https://github.com/owner/repo/blob/${SHA}`;

describe("the source URL for files in the repository", () => {
  it("points at the commit the run tested", () => {
    expect(
      sourceUrlFrom({
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "owner/repo",
        SOURCE_SHA: SHA,
      }),
    ).toBe(SOURCE_URL);
  });

  it("is missing outside GitHub Actions", () => {
    expect(sourceUrlFrom({})).toBeUndefined();
  });

  it("is missing when the run doesn't say which commit it tested", () => {
    expect(
      sourceUrlFrom({
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "owner/repo",
      }),
    ).toBeUndefined();
  });
});
