# Weather Widget

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, each label string equal to its role. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## File structure and naming

Name each module in `src/` after its main export, in kebab-case, using `GLOSSARY.md` terms:

- Start with the feature it belongs to: `forecast-view.ts`, `weather-provider-conditions.ts`.
- End with its role when it has one: `-client` calls a Proxy endpoint, `-provider` adapts an external provider, then `-view`, `-loader`, `-styles`.
- Start names from the feature, since the package folder already names the package: `location-picker/src/messages.ts` exports `MESSAGES`.
- Give a role the same name in every package: `index.ts` only re-exports and registers the custom element, `<tag-name>.ts` holds the element, and `messages.ts` (`MESSAGES`, `Messages`), `styles.ts` (`styles`), `theme-styles.ts` and `build-output.ts` keep their names.

Keep `src/` flat; a subfolder holds assets only, such as `icons/`. Tests live in a `test/` folder beside the code they test, one file per behaviour (`search.test.ts`), with shared fixtures and helpers in `test/support.ts`. Vitest files end in `.test.ts` and the Playwright files in `e2e/` end in `.spec.ts`, so neither runner picks up the other's files.
