# Weather Widget

A self-contained component that shows the weather forecast for one Location. Any Host page can embed it, several times on one page if it likes.

## Language

**Widget**:
The self-contained component that shows the Forecast for one Location, configured entirely by its Host page.
_Avoid_: App, page, dashboard, card

**Host page**:
A page that embeds one or more Widgets and gives each one its configuration (coordinates, locale, units, Forecast parts, Theme).
_Avoid_: Parent, container, demo app

**Visitor**:
The person who reads a Widget or uses a Location picker on a Host page.
_Avoid_: User, customer

**Example host**:
A Host page we build ourselves in one framework, or none, to show how Widgets are embedded there.
_Avoid_: Demo app, showcase, playground

**Widget settings**:
A form on an Example host that changes one Widget: its locale, units and Forecast parts, its Theme and color scheme, and the width it gets.
_Avoid_: Playground, config panel, controls

**Theme**:
The Host page's own font, colors and corner radius for a Widget and its Location picker.
_Avoid_: Skin, branding, style

**Location**:
The place a Forecast is for, with coordinates, a time zone and usually a name. The Host page gives the coordinates and may give the name; the Weather provider supplies the time zone and, if it finds one, the name.
_Avoid_: City, place, position

**Location picker**:
An optional component, separate from the Widget, that a Host page can use to let the Visitor choose a Location by name or from their device.
_Avoid_: Search box, city selector, location input

**Location time**:
The clock time and calendar day at the Location, which can differ from the Visitor's own.
_Avoid_: Local time, Location's local time, visitor time

## Forecast

**Forecast**:
The weather outlook for one Location: its Current weather, Hourly forecast and Daily forecast together.
_Avoid_: Weather data, report

**Forecast part**:
One of the three parts of a Forecast: Current weather, Hourly forecast or Daily forecast. The Host page chooses which ones the Widget shows, and each one loads or fails on its own.
_Avoid_: Section, block, module

**Current weather**:
The weather at the Location right now.
_Avoid_: Now, realtime, current conditions

**Hourly forecast**:
The expected weather per hour for the next 12 hours.
_Avoid_: Timeline, hourly data

**Daily forecast**:
The expected weather per day for the next 5 days: Condition, high, low and chance of precipitation.
_Avoid_: Week forecast, daily data

**Condition**:
The kind of weather in a period (clear, cloudy, rain, snow and so on), shown as an icon. Current weather shows its name; elsewhere only screen readers read it.
_Avoid_: Weather type, weather code, status

**Day or night**:
Whether a period at the Location falls by day or by night, which decides whether its Condition shows the sun or the moon. The Daily forecast is always by day.
_Avoid_: Daylight, time of day, day/night flag, is day

**Update time**:
The moment the Weather provider observed the Current weather, shown in Location time. It can be up to an hour old.
_Avoid_: Last updated, refresh time, timestamp

**Unavailable message**:
The short message that takes the place of one Forecast part that failed.
_Avoid_: Part error, empty state

**Error state**:
What the Widget shows instead of the Forecast when no Forecast part loads, with a Try again button.
_Avoid_: Error page, fallback

## Services

**Weather provider**:
The external weather service the Forecast comes from, which also names a Location from its coordinates.
_Avoid_: Provider, API, source, backend

**Search provider**:
The external service that finds a Location by the name a Visitor types.
_Avoid_: Geocoder, places API

**Credit**:
The visible link to the Weather provider or the Search provider that their terms of use require.
_Avoid_: Attribution, footer

**Proxy**:
Our own server that Widgets and the Location picker call, and the only party that talks to the Weather provider and the Search provider.
_Avoid_: API, backend, BFF
