# Testing

Each behaviour is asserted in one place: the cheapest kind of test that can prove it. The commands to run each kind are in the [README](README.md#running-testing-and-deploying), and the folder and file naming is in [AGENTS.md](AGENTS.md#file-structure-and-naming).

## Kinds of tests

| Kind            | Runner and place                                                                  | Owns                                                                                                                                                                                                        | Fakes                                                                                                     |
| --------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Script tests    | Vitest in Node, `scripts/test/`                                                   | What the CI summary scripts write                                                                                                                                                                           | Nothing: the tests pass the input in                                                                      |
| Proxy tests     | Vitest in Node, `packages/proxy/test/`, through `proxy.request`                   | The HTTP contract: status codes, Problem Details, cache and CORS headers, how the Weather provider's and the Search provider's answers become the contract, and which Forecast part fails when a call fails | The `fetch` to the Weather provider and the Search provider, mostly with their recorded responses         |
| Component tests | Vitest browser mode, `packages/widget/test/` and `packages/location-picker/test/` | Everything the Widget and the Location picker show and do for given attributes and Proxy answers: text, locale, units, layout at their own width, focus, announcements, reduced motion                      | The `fetch` to the Proxy, and browser APIs the test has to steer, such as geolocation and page visibility |
| e2e tests       | Playwright in `e2e/`, on the built Example hosts with the Proxy in fixture mode   | How each Example host wires its controls to the Widget, the page as a whole, and how the Widget and the Location picker ship                                                                                | Fixture mode, and the clock, geolocation and slow network the test steers                                 |
| Lighthouse      | `lighthouserc.json`, on the built pages                                           | Scores per page and the script size budgets                                                                                                                                                                 | Nothing beyond fixture mode                                                                               |

## Which kind owns a behaviour

Start at the cheapest kind and move down the table only when that kind can't prove the behaviour. A conversion to Fahrenheit is a component test. The Units radio buttons changing the Widget's `units` attribute is an e2e test, because each Example host writes that wiring itself.

When two kinds assert the same behaviour, keep the cheaper one and remove the assertion from the other.

## e2e tests on every Example host

An e2e test runs on all three Example hosts when it goes through code each host writes itself:

- the Widget settings and their state
- the hand-off from the Location picker to the Widget
- the page's markup, CSS and head

A behaviour that stays inside the Widget or the Location picker belongs in a component test. Tests of how the modules ship are the exception: the standalone modules run on the vanilla host and the bundles on the React and Angular hosts.

## Table-driven tests

Each row of an `it.each` or a looped test reaches a branch or a boundary in the code that the other rows don't. For a range lookup, test the two ends of each range and a value in each gap. Values the code treats the same way share one row.

## Waiting

Wait for a condition: a web-first assertion, `expect.poll` or `vi.waitFor`. A fixed delay belongs only in a test about the delay itself, such as a module that loads slowly.
