# Names for coordinates come from the Weather provider

The Widget names its Location even when the Host page gives only coordinates, so the Proxy needs a name for a pair of coordinates. The Search provider, Open-Meteo, finds Locations by name but can't do the reverse, so the Proxy asks OpenWeather's reverse geocoding for the name, next to the Forecast calls and with the same key.

## Considered Options

- **A second geocoding service for reverse lookups**: another service with its own terms and limits, for a single lookup per Forecast.
- **No name from the Proxy**: the Widget would show coordinates unless the Host page sets `location-name`, which reads poorly for a visitor using their device's Location.

## Consequences

- A Forecast costs one more Weather provider call when the CDN has no cached copy, which counts towards the 1,000 free calls a day.
- The name is optional: when the lookup fails or finds nothing, the Forecast keeps its other data and the Widget falls back to the coordinates.
- A name found by search and a name found from coordinates can differ for the same place, because they come from different services.
