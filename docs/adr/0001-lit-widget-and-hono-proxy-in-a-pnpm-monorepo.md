# A Lit web component and a Hono Proxy in one pnpm monorepo

The Widget is a Lit web component, so any Host page can embed it, whatever its framework and as many times as it likes. A Hono Proxy is the only party that holds the Weather provider's key. Both live in one pnpm workspace together with the Example hosts (vanilla, React and Angular), so a change to the Widget or to the Proxy's contract is checked against every host in the same commit. The brief recommends a framework such as Angular, React or Vue. We build the Widget once as a custom element instead, and show it working inside two of those frameworks.

## Considered Options

- **The Widget in Angular or React**: shows the framework directly, but only embeds in hosts that use that framework and version.
- **A meta-framework such as Astro or Next.js**: one deploy with a built-in proxy and server rendering, but the Widget becomes a page that other sites can't embed.
- **Separate repositories for the Widget, Proxy and hosts**: closer to how a third party would consume them, but every contract change would span several repositories and releases.

## Consequences

- Nothing renders until the Widget's script runs. The Widget shows a skeleton of fixed size while it loads, and SEO is the Host page's job.
- The Proxy is built as if third-party sites call it, even though the Example hosts are our own: CORS for any origin, a 10-minute CDN cache and a hard daily cap at the Weather provider. Rate limiting is left for later.
