# Built-in CI reporters

CI keeps its own summary scripts. They turn the results of the checks, Vitest, Playwright and Lighthouse into Markdown summaries on each pull request, and we don't replace them with the reporters those tools ship.

## Why this is out of scope

The maintainer decided to keep the summaries as they are. The scripts are tested like the rest of the code, and they give each pull request one summary per job in the same format, with links to the source of each failure. The built-in reporters (Vitest's `github-actions`, Playwright's `github` and the lhci output) each report in their own format.

## Prior requests

- #51: "Replace the custom CI summary scripts with built-in reporters"
