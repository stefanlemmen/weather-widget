# The Host page owns the Location

The Widget has no location UI: it shows the Forecast for the coordinates its Host page gives it, and nothing inside the Widget can change them. On a page with several Widgets, a search box or "use my location" button in each one would repeat the same control and leave the visitor unsure which Widget it changes. Location search and "use my location" ship as an optional Location picker that emits the chosen Location, and the Host page decides which Widget receives it.

## Considered Options

- **Location UI inside the Widget**: self-contained, but repeated in every Widget, and it makes the Widget bigger.
- **Each Example host builds its own**: three implementations of the same control.

## Consequences

- The Location picker and the Widget don't know about each other: the picker emits a `location-select` event and the Host page sets the Widget's Location.
- The Location picker is kept minimal (a form, results as buttons, no autocomplete), so it can be dropped without touching the Widget.
- The Location picker ships as its own package, `@weather-widget/location-picker`, served from `/location-picker/weather-location-picker.js`. A Host page without a picker never loads its code. The picker keeps its own copy of the theme styles it uses, and an e2e test checks that its fallbacks match the Widget's.
- Location search goes through the Proxy to the Search provider, Open-Meteo, whose free tier allows only non-commercial use and requires CC BY 4.0 credit.
