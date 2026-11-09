# Weather Widget

`<weather-widget>` is a web component that shows the weather forecast for one Location: Current conditions first, then the Hourly forecast, then the Daily forecast for the next 5 days. Any Host page can embed it, in any framework, as often as it likes. An optional `<weather-location-picker>` lets the visitor choose a Location by name or from their device.

See it running at <https://weather-widget-ruby-delta.vercel.app/>, which links to the three Example hosts: plain HTML, React and Angular.

The words used here (Widget, Host page, Location, Forecast part, Proxy and so on) are defined in [GLOSSARY.md](GLOSSARY.md).

## Architecture

```text
Host page ──► <weather-widget>          ──┐
          └─► <weather-location-picker> ──┤  same origin
                                          ▼
                                   Proxy (/api) ──► OpenWeather (Forecast, names for coordinates)
                                                └─► Open-Meteo (Location search)
```

The repository is one pnpm workspace:

| Path                       | What it is                                                                      |
| -------------------------- | ------------------------------------------------------------------------------- |
| `packages/widget`          | The Widget, a Lit custom element                                                |
| `packages/location-picker` | The Location picker, a separate Lit custom element                              |
| `packages/proxy`           | The Proxy, a Hono app that holds the Weather provider's API key                 |
| `packages/contract`        | The Valibot schemas and types the Proxy and the components share                |
| `packages/landing-page`    | The landing page at `/`                                                         |
| `hosts/vanilla`            | Example host in plain HTML, loading the standalone ES modules                   |
| `hosts/react`              | Example host in React, importing the packages                                   |
| `hosts/angular`            | Example host in Angular, importing the packages                                 |
| `e2e`                      | Playwright tests that run one suite against all three Example hosts             |
| `scripts`                  | The build step that writes Vercel's Build Output, the preview server, CI output |

### Why it's built this way

- The Widget is a custom element ([ADR 0001](docs/adr/0001-lit-widget-and-hono-proxy-in-a-pnpm-monorepo.md)). A React or Angular component only embeds in hosts that use that framework and version. A custom element works in all of them, which the React and Angular Example hosts prove. Lit keeps the standalone module small (the Lighthouse budget allows 50 KiB of script on the plain HTML host).
- Widgets ask our Proxy, never the Weather provider ([ADR 0001](docs/adr/0001-lit-widget-and-hono-proxy-in-a-pnpm-monorepo.md)), so the OpenWeather key never reaches the browser. The Proxy lets the CDN cache each Forecast for 10 minutes and serve a stale copy for up to an hour when OpenWeather fails. Widgets that share a Location and differ only in locale or units ask for the same URL, so they share one cached Forecast.
- Everything lives in one workspace ([ADR 0001](docs/adr/0001-lit-widget-and-hono-proxy-in-a-pnpm-monorepo.md)), so a change to the Widget or to the Proxy's contract is checked against every Example host in the same commit.
- The Host page owns the Location ([ADR 0002](docs/adr/0002-the-host-page-owns-the-location.md)). The Widget has no search box, because on a page with several Widgets a search box in each would repeat the same control. The Location picker is its own package: it emits a `location-select` event and the Host page decides which Widget gets the Location. A page without a picker never loads its code.
- Our build writes Vercel's Build Output ([ADR 0003](docs/adr/0003-our-build-writes-the-vercel-build-output.md)). One Vercel project serves the landing page, the Example hosts, the standalone modules and the Proxy from one domain, so every Example host is same-origin with the Proxy.
- Names for coordinates come from OpenWeather ([ADR 0004](docs/adr/0004-names-for-coordinates-come-from-the-weather-provider.md)), so the Widget names its Location even when it only gets coordinates. When that lookup fails, it shows the coordinates.
- Each Forecast part loads or fails on its own. If the Hourly forecast fails, the Widget still shows the Current conditions and the Daily forecast, with a short message where the Hourly forecast would be. Only when nothing loads does it show an error with a "Try again" button.

The visual design and the theming rules are in [DESIGN.md](DESIGN.md), the audience and product principles in [PRODUCT.md](PRODUCT.md).

## Embedding the Widget

### Plain HTML

Load the standalone module once and add as many Widgets as you like:

```html
<script type="module" src="/widget/weather-widget.js"></script>

<weather-widget latitude="52.03" longitude="5.08"></weather-widget>
<weather-widget
  latitude="48.85"
  longitude="2.35"
  location-name="Paris"
  locale="nl"
  units="imperial"
  parts="current daily"
></weather-widget>
```

The module is served at a stable URL, `/widget/weather-widget.js`, and the Location picker at `/location-picker/weather-location-picker.js`. To connect the picker to a Widget, listen for its event and set the Widget's properties:

```html
<script
  type="module"
  src="/location-picker/weather-location-picker.js"
></script>

<weather-location-picker></weather-location-picker>
<weather-widget id="chosen" latitude="52.03" longitude="5.08"></weather-widget>

<script type="module">
  const widget = document.querySelector("#chosen");
  document
    .querySelector("weather-location-picker")
    .addEventListener("location-select", ({ detail }) => {
      widget.latitude = detail.latitude;
      widget.longitude = detail.longitude;
      widget.locationName = detail.name ?? undefined;
    });
</script>
```

### React

Import the packages once to register the elements. React 19 sets properties on custom elements and binds `on<event>` props to custom events:

```tsx
import "@weather-widget/widget";
import "@weather-widget/location-picker";
import type { LocationSelectDetail } from "@weather-widget/location-picker";
import { useState } from "react";

export const Forecast = () => {
  const [chosen, setChosen] = useState<LocationSelectDetail>({
    latitude: 52.03,
    longitude: 5.08,
    name: null,
  });

  return (
    <>
      <weather-location-picker
        onlocation-select={({ detail }) => setChosen(detail)}
      />
      <weather-widget
        latitude={chosen.latitude}
        longitude={chosen.longitude}
        locationName={chosen.name ?? undefined}
        style={{ "--weather-accent": "#9c3412" }}
      />
    </>
  );
};
```

For type checking in JSX, copy the declarations in [`hosts/react/src/intrinsic-elements.d.ts`](hosts/react/src/intrinsic-elements.d.ts).

### Angular

Import the packages once (for example in `main.ts`) and allow custom elements in the component that uses them:

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA, signal } from "@angular/core";
import type { LocationSelectDetail } from "@weather-widget/location-picker";

@Component({
  selector: "app-forecast",
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <weather-location-picker
      (location-select)="chosen.set($event.detail)"
    ></weather-location-picker>
    <weather-widget
      [latitude]="chosen().latitude"
      [longitude]="chosen().longitude"
      [locationName]="chosen().name ?? undefined"
      locale="nl"
    ></weather-widget>
  `,
})
export class Forecast {
  protected readonly chosen = signal<LocationSelectDetail>({
    latitude: 52.03,
    longitude: 5.08,
    name: null,
  });
}
```

The packages aren't published to npm. The React and Angular Example hosts use them as workspace packages.

## Reference

### `<weather-widget>`

Every attribute has a property of the same meaning. Set either one.

| Attribute       | Property       | Type and default                                     | What it does                                                                                                                                                                       |
| --------------- | -------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `latitude`      | `latitude`     | number from -90 to 90, required                      | The Location's latitude                                                                                                                                                            |
| `longitude`     | `longitude`    | number from -180 to 180, required                    | The Location's longitude                                                                                                                                                           |
| `location-name` | `locationName` | string, optional                                     | The name shown for the Location. Without it, the Widget shows the name OpenWeather has for the coordinates, or the coordinates themselves                                          |
| `locale`        | `locale`       | `"en"` (default) or `"nl"`                           | The language of every text, and the format of times and numbers. Any other value falls back to `"en"`                                                                              |
| `units`         | `units`        | `"metric"` (default) or `"imperial"`                 | °C and km/h, or °F and mph. Any other value falls back to `"metric"`                                                                                                               |
| `parts`         | `parts`        | space-separated list, default `current hourly daily` | The Forecast parts to show and fetch, from `current`, `hourly` and `daily`. They always appear in that order. Unknown names are ignored; a list with no known name shows all three |
| `proxy-url`     | `proxyUrl`     | URL, default `/api`                                  | Where the Widget asks for Forecasts. A relative URL resolves against the page                                                                                                      |

The Proxy rounds coordinates to 2 decimals (about 1 km) before it asks OpenWeather. Missing or invalid coordinates show a message instead of a Forecast. Hours and days are shown in the Location's local time, not the visitor's.

The Widget emits no events. While it loads, it sets `aria-busy="true"` on itself and shows a skeleton of its final size.

### `<weather-location-picker>`

| Attribute   | Property   | Type and default           | What it does                                         |
| ----------- | ---------- | -------------------------- | ---------------------------------------------------- |
| `locale`    | `locale`   | `"en"` (default) or `"nl"` | The language of every text and of the search results |
| `proxy-url` | `proxyUrl` | URL, default `/api`        | Where the picker searches for Locations              |

| Event             | `detail`                                                        | When                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `location-select` | `{ latitude: number; longitude: number; name: string \| null }` | The visitor picks a search result, or uses their device's Location. `name` is `null` for the device's Location, whose coordinates are rounded to 2 decimals |

The event bubbles and crosses shadow roots (`composed`). "Use my location" only appears when the browser has the Geolocation API.

### CSS custom properties

Both elements read these, so one rule can theme a Widget and its picker. Set them on the element or on any ancestor.

| Property               | Default (light / dark)            | What it sets                                                |
| ---------------------- | --------------------------------- | ----------------------------------------------------------- |
| `--weather-font`       | `"Lexend", system-ui, sans-serif` | All text. The Widget doesn't load Lexend; the Host page can |
| `--weather-background` | `#eef3f9` / `#16263b`             | The background, and the tints mixed from it                 |
| `--weather-ink`        | `#13243a` / `#f2f5f9`             | Text and icons                                              |
| `--weather-accent`     | `#17703f` / `#6fdc9b`             | Links, buttons, the focus ring and text selection           |
| `--weather-radius`     | `12px`                            | The corners; buttons and fields use half of it              |

```css
weather-widget,
weather-location-picker {
  --weather-background: light-dark(#fffaf2, #2b1d16);
  --weather-ink: light-dark(#2b1d16, #fffaf2);
}
```

> [!WARNING]
> Theming can break contrast. The defaults meet WCAG 2.1 AA in the light and dark color scheme, and every other tone is mixed from the background and ink. Your values carry no such check. When you set `--weather-background`, also set `--weather-ink`, and give both a light and a dark value with `light-dark()`, or fix the scheme with `color-scheme: light` on the element. Check the contrast of your colors in both schemes.

### Browser support

The Widget and the Location picker need `light-dark()` in CSS, which sets the oldest supported versions: Chrome and Edge 123, Firefox 120, and Safari 17.5 on macOS and iOS. They also use container queries, `color-mix()` and custom elements with Shadow DOM, which those versions support. Nothing renders without JavaScript.

## Running your own Proxy

The Widget never calls OpenWeather itself, so a Host page needs a Proxy. To run your own:

1. Get an OpenWeather API key with access to One Call API 4.0 and set it as `OPENWEATHER_API_KEY` in the Proxy's environment. Without it, the Proxy stops at startup with an error that names the variable.
2. Deploy the Proxy. This repository deploys to Vercel as it is: import it as a project, add `OPENWEATHER_API_KEY` under Environment Variables and deploy. The Proxy then answers under `/api` on that project's domain. It is a Hono app (`createProxy` in `packages/proxy`), but Vercel is the only platform this repository builds it for.
3. Point each Widget's and Location picker's `proxy-url` at the Proxy's `/api` URL.

The Proxy doesn't send CORS headers yet, so a browser only lets a page call it from the same origin. Put the Proxy on the Host page's own domain: deploy the Host page in the same Vercel project, or have the Host page's server forward `/api/` to the Proxy with the `/api` prefix intact. The default `proxy-url` is `/api`, so on the same domain you don't have to set it:

```html
<weather-widget latitude="52.03" longitude="5.08"></weather-widget>
<weather-widget
  latitude="52.03"
  longitude="5.08"
  proxy-url="/api"
></weather-widget>
```

Both Widgets above ask the same Proxy. Once the Proxy sends CORS headers, `proxy-url` can point at another domain, such as `https://weather.example.com/api`.

OpenWeather's One Call API 4.0 is free for 1,000 calls a day, and calls above that are billed. A Forecast that isn't cached yet costs up to 4 calls: one per Forecast part, plus one for the Location's name.

## Running, testing and deploying

You need Node 26 and pnpm 11.

```sh
pnpm install
cp .env.example .env   # then set OPENWEATHER_API_KEY, or PROVIDER_MODE=fixtures
pnpm dev               # the Proxy on :8787 and every Example host, each with its own URL
```

With `PROVIDER_MODE=fixtures` the Proxy answers from recorded responses instead of calling OpenWeather and Open-Meteo, so you don't need a key. The recordings cover a Forecast for Nieuwegein and searches for "Paris", "Parijs" and "Parjs".

| Command                                            | What it checks                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `pnpm typecheck`, `pnpm lint`, `pnpm format:check` | Types, lint rules and formatting                                                               |
| `pnpm test`                                        | Unit tests, the Proxy over HTTP, and the components in a real browser with Vitest browser mode |
| `pnpm build && pnpm test:e2e`                      | All three Example hosts end to end with Playwright and axe, against the Proxy in fixture mode  |
| `pnpm build && pnpm lighthouse`                    | Performance, accessibility, best practices and SEO, and the script size budget per page        |
| `pnpm build && pnpm preview`                       | Serves the production build and the Proxy on <http://localhost:4173>                           |

Browser tests need Chromium: `pnpm exec playwright install chromium`.

CI runs all of these on every pull request. To deploy, connect the repository to a Vercel project and set `OPENWEATHER_API_KEY` in its environment variables. Vercel runs `pnpm build`, which writes the whole site and the Proxy function to `.vercel/output` ([ADR 0003](docs/adr/0003-our-build-writes-the-vercel-build-output.md)).

## Next steps

- Rate limiting on the Proxy. The CDN cache absorbs repeat requests, but every uncached Location still costs OpenWeather calls, and calls beyond the free 1,000 a day are billed.
- Widget events such as `forecast-load` and `forecast-error`, so a Host page can react when a Forecast arrives or fails.
- More locales. Every text lives in one messages module per package, and dates and numbers already go through `Intl`, so a locale is mostly a translation.
