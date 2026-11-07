# Our build writes the Vercel Build Output

One Vercel project serves every build and the Proxy from one domain. Our own build writes Vercel's Build Output API layout to `.vercel/output`: `scripts/write-vercel-output.ts` copies all static builds from `dist/` to `static/`, and the Proxy, bundled into one ES module, to the `api` function. Vercel's `api/` directory convention fails in this workspace. Vercel compiles `api/index.ts` but not the workspace TypeScript it imports, so the first preview deploy crashed with `ERR_MODULE_NOT_FOUND`.

## Considered Options

- **`vercel.json` with an `api/` function**: tried first and failed as above. Fixing it means compiling every workspace package to JavaScript before Vercel traces it.
- **One Vercel project per Example host**: simpler builds, but the Example hosts would leave the Proxy's domain, and the brief asks for same-origin.

## Consequences

- A new build joins by writing to its own path in `dist/`: the landing page to `dist/index.html`, the React and Angular Example hosts to `dist/react/` and `dist/angular/`, and the standalone Widget module to `dist/widget/weather-widget.js`, which becomes its stable URL. The React host sets Vite's `base` to its path. The Angular host sets `baseHref` and an `outputPath` whose `browser` folder lands in `dist/angular/`, because Angular builds to `dist/<project>/browser/` by default. The script copies `dist/` as a whole, so adding a build doesn't change it.
- The Proxy function has no `node_modules` at runtime. Everything it imports is in the bundle.
- `vercel.json` sets `framework: null`, because the project still has the Astro preset from an earlier version of the app.
